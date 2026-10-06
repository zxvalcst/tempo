import { localSegments, minutesFromHhMm, weekdayOfDateOnly, type LocalSegment } from "@/lib/dates";
import type { Commitment, PlannedSession, Profile, Session, Task } from "@/lib/types";
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES, sleepingIntervals } from "./slots";

export type PlanProblem = {
  taskId: string | null;
  message: string;
};

export type PlanValidation = { ok: true } | { ok: false; problems: PlanProblem[] };

export type PlanContext = {
  tasks: Task[];
  profile: Profile;
  commitments: Commitment[];
  fixedSessions: Session[];
};

/** Does a local span collide with any commitment that applies on that day? */
function overlapsCommitments(
  segments: LocalSegment[],
  commitments: Commitment[],
): boolean {
  for (const segment of segments) {
    const weekday = weekdayOfDateOnly(segment.dateOnly);

    for (const commitment of commitments) {
      const applies = commitment.is_recurring
        ? commitment.day_of_week === weekday
        : commitment.specific_date === segment.dateOnly;

      if (!applies) continue;

      const from = minutesFromHhMm(commitment.start_time);
      const to = minutesFromHhMm(commitment.end_time);

      if (segment.from < to && segment.to > from) return true;
    }
  }

  return false;
}

/** Does a local span collide with a `moved` or `done` session on that day? */
function overlapsFixedSessions(
  segments: LocalSegment[],
  fixedSessions: Session[],
  timeZone: string,
): boolean {
  for (const segment of segments) {
    for (const session of fixedSessions) {
      const others = localSegments(
        new Date(session.planned_start),
        new Date(session.planned_end),
        timeZone,
      );

      for (const other of others) {
        if (other.dateOnly !== segment.dateOnly) continue;
        if (segment.from < other.to && segment.to > other.from) return true;
      }
    }
  }

  return false;
}

/**
 * The hard gate before anything is written.
 *
 * The deterministic scheduler in `schedule.ts` cannot produce an invalid plan,
 * so for 3a this is belt and braces. It exists as an independent check on
 * purpose: when `llm.ts` lands in the next slice its output has to pass exactly
 * this, and the LLM is not to be trusted with validity.
 *
 * Returns a result rather than throwing, so the caller can surface every
 * problem instead of only the first.
 */
export function validatePlan(
  candidate: PlannedSession[],
  context: PlanContext,
  now: Date = new Date(),
): PlanValidation {
  const { profile, commitments, fixedSessions } = context;
  const timeZone = profile.timezone;
  const dailyCapMinutes = Number(profile.work_hours_per_day) * 60;
  const sleeping = sleepingIntervals(profile);
  const nowMs = now.getTime();

  const problems: PlanProblem[] = [];
  const accepted: Array<{ start: Date; end: Date }> = [];
  const minutesByDay = new Map<string, number>();

  const tasksById = new Map(context.tasks.map((task) => [task.id, task]));

  for (const session of candidate) {
    const start = new Date(session.start);
    const end = new Date(session.end);
    const task = tasksById.get(session.task_id);
    const label = task ? `"${task.title}"` : session.task_id;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      problems.push({ taskId: session.task_id, message: `${label}: unreadable start or end time.` });
      continue;
    }

    if (end.getTime() <= start.getTime()) {
      problems.push({ taskId: session.task_id, message: `${label}: a session must end after it starts.` });
      continue;
    }

    if (!task) {
      problems.push({ taskId: session.task_id, message: `Unknown task ${session.task_id}.` });
      continue;
    }

    const duration = (end.getTime() - start.getTime()) / 60_000;

    if (duration < MIN_SESSION_MINUTES || duration > MAX_SESSION_MINUTES) {
      problems.push({
        taskId: task.id,
        message: `${label}: sessions must be ${MIN_SESSION_MINUTES}-${MAX_SESSION_MINUTES} minutes, got ${Math.round(duration)}.`,
      });
      continue;
    }

    if (start.getTime() < nowMs) {
      problems.push({ taskId: task.id, message: `${label}: a session cannot start in the past.` });
      continue;
    }

    if (end.getTime() > new Date(task.deadline).getTime()) {
      problems.push({ taskId: task.id, message: `${label}: a session cannot run past its deadline.` });
      continue;
    }

    // Splitting by local day is what makes the sleep and daily-limit checks
    // correct for a session that runs across local midnight.
    const segments = localSegments(start, end, timeZone);

    const insideSleep = segments.some((segment) =>
      sleeping.some((piece) => segment.from < piece.to && segment.to > piece.from),
    );

    if (insideSleep) {
      problems.push({ taskId: task.id, message: `${label}: falls inside the sleep window.` });
      continue;
    }

    if (overlapsCommitments(segments, commitments)) {
      problems.push({ taskId: task.id, message: `${label}: overlaps a fixed commitment.` });
      continue;
    }

    if (overlapsFixedSessions(segments, fixedSessions, timeZone)) {
      problems.push({ taskId: task.id, message: `${label}: overlaps a session that must not move.` });
      continue;
    }

    const clashes = accepted.some(
      (other) => start.getTime() < other.end.getTime() && end.getTime() > other.start.getTime(),
    );

    if (clashes) {
      problems.push({ taskId: task.id, message: `${label}: overlaps another session in the same plan.` });
      continue;
    }

    accepted.push({ start, end });

    for (const segment of segments) {
      const span = segment.to - segment.from;
      minutesByDay.set(segment.dateOnly, (minutesByDay.get(segment.dateOnly) ?? 0) + span);
    }
  }

  for (const [dateOnly, minutes] of minutesByDay) {
    if (minutes > dailyCapMinutes) {
      const hours = Math.round((minutes / 60) * 10) / 10;
      problems.push({
        taskId: null,
        message: `${dateOnly} has ${hours}h planned, over the ${Number(profile.work_hours_per_day)}h daily limit.`,
      });
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
