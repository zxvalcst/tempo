import { addDaysTo, dateOnlyIn, zonedTimeToUtc } from "@/lib/dates";
import type { Commitment, PlannedSession, Profile, Session, Task } from "@/lib/types";
import { scoreTasks, type ScoredTask } from "./score";
import {
  findFreeSlots,
  HORIZON_DAYS,
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  SESSION_GRANULARITY_MINUTES,
  type FreeSlot,
} from "./slots";

const DAY_MS = 86_400_000;

export type OverloadReport = {
  /** The earliest deadline that cannot be met. */
  deadline: string;
  availableMinutes: number;
  demandedMinutes: number;
  tasks: Array<{ id: string; title: string; minutes: number }>;
};

/** Whole local calendar days from `now` to the deadline; negative if past. */
function calendarDaysUntil(now: Date, deadline: string, timeZone: string): number {
  const today = dateOnlyIn(timeZone, now);
  const due = dateOnlyIn(timeZone, new Date(deadline));

  return Math.round(
    (new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
}

/** "2" -> "2", "12.5" -> "12.5" */
function trimNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The one sentence shown next to a session. Deterministic — it explains why the
 * scheduler chose this work, which comes entirely from the task itself.
 */
export function buildReason(
  candidate: ScoredTask,
  now: Date,
  timeZone: string,
  index: number,
  total: number,
): string {
  const days = calendarDaysUntil(now, candidate.deadline, timeZone);

  let phrase: string;
  if (days < 0) {
    phrase = `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  } else if (days === 0) {
    phrase = "Due today";
  } else if (days === 1) {
    phrase = "Due tomorrow";
  } else {
    phrase = `Due in ${days} days`;
  }

  if (candidate.grade_weight > 0) {
    phrase += `, ${trimNumber(candidate.grade_weight)}% of grade`;
  }

  // Only worth saying when the task was actually split across several blocks.
  if (total > 1) {
    phrase += ` · session ${index} of ${total}`;
  }

  return phrase;
}

/**
 * Candidates for this week's plan: not finished, and due inside the 7-day
 * window. A task due in twelve days is a future week's problem, not this one's.
 */
function windowCandidates(
  profile: Profile,
  tasks: Task[],
  completedMinutes: Record<string, number>,
  slots: FreeSlot[],
  now: Date,
): ScoredTask[] {
  const windowEnd =
    zonedTimeToUtc(addDaysTo(dateOnlyIn(profile.timezone, now), HORIZON_DAYS), 0, profile.timezone)
      .getTime();

  return scoreTasks(tasks, Number(profile.pace_factor), completedMinutes, now).filter(
    (candidate) =>
      candidate.status !== "done" &&
      candidate.remainingMinutes > 0 &&
      new Date(candidate.deadline).getTime() <= windowEnd,
  );
}

/**
 * Greedy placement: highest score first, earliest slot first.
 *
 * Each placement consumes from both the task's remaining minutes and the slot's
 * remaining minutes, so a large task naturally spreads across gaps and days
 * without any special-case splitting logic.
 */
export function buildWeek(
  profile: Profile,
  tasks: Task[],
  commitments: Commitment[],
  fixedSessions: Session[],
  completedMinutes: Record<string, number>,
  now: Date = new Date(),
): { sessions: PlannedSession[]; candidates: ScoredTask[] } {
  const timeZone = profile.timezone;
  const slots = findFreeSlots(profile, commitments, fixedSessions, now);
  const candidates = windowCandidates(profile, tasks, completedMinutes, slots, now);

  const dailyCap = Number(profile.work_hours_per_day) * 60;
  const usedInSlot = new Map<string, number>();
  const usedInDay = new Map<string, number>();
  const sessions: PlannedSession[] = [];

  for (const candidate of candidates) {
    let remaining = candidate.remainingMinutes;
    const deadlineMs = new Date(candidate.deadline).getTime();
    const blocksNeeded = Math.ceil(candidate.remainingMinutes / MIN_SESSION_MINUTES);
    let placed = 0;

    for (const slot of slots) {
      if (remaining <= 0) break;

      const usedMinutes = usedInSlot.get(slot.start) ?? 0;
      let free = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000 - usedMinutes;
      if (free <= 0) continue;

      const dayUsed = usedInDay.get(slot.dateOnly) ?? 0;
      if (dayUsed >= dailyCap) continue;
      free = Math.min(free, dailyCap - dayUsed);

      // Half-hour boundaries so neighbouring sessions leave a reusable gap.
      let size = Math.min(remaining, free, MAX_SESSION_MINUTES);
      size = Math.floor(size / SESSION_GRANULARITY_MINUTES) * SESSION_GRANULARITY_MINUTES;
      if (size < MIN_SESSION_MINUTES) continue;

      const startMs = new Date(slot.start).getTime() + usedMinutes * 60_000;
      const endMs = startMs + size * 60_000;

      // Slots are chronological, so once this one overshoots, so do all the rest.
      if (endMs > deadlineMs) break;

      usedInSlot.set(slot.start, usedMinutes + size);
      usedInDay.set(slot.dateOnly, dayUsed + size);
      remaining -= size;
      placed += 1;

      sessions.push({
        task_id: candidate.id,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        reason: buildReason(candidate, now, timeZone, placed, blocksNeeded),
      });
    }
  }

  return { sessions, candidates };
}

/**
 * Cumulative overload, per deadline.
 *
 * For each deadline the pool is everything still free before it, and the demand
 * is every task due at or before it — so one task's hours are genuinely inside
 * the pool another task needs. That is the contention the warning exists to
 * surface; checking each task in isolation would report nothing until a single
 * task was impossible on its own.
 *
 * The pool runs to the deadline itself, not to the start of the deadline's day.
 * Excluding the deadline day would report every task due *today* as overloaded,
 * because no hours exist "before today".
 *
 * Exported and pure so the dashboard can recompute the warning from live data
 * instead of trusting whatever was true when a plan was last generated.
 */
export function findOverload(
  profile: Profile,
  tasks: Task[],
  commitments: Commitment[],
  fixedSessions: Session[],
  completedMinutes: Record<string, number>,
  now: Date = new Date(),
): OverloadReport | null {
  const slots = findFreeSlots(profile, commitments, fixedSessions, now);
  const candidates = windowCandidates(profile, tasks, completedMinutes, slots, now);

  if (candidates.length === 0) return null;

  const dailyCap = Number(profile.work_hours_per_day) * 60;
  const deadlines = [...new Set(candidates.map((candidate) => candidate.deadline))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  for (const deadline of deadlines) {
    const deadlineMs = new Date(deadline).getTime();

    // The pool is capped per local day, because `buildWeek` will not place more
    // than `work_hours_per_day` in a day. Measuring against raw free time would
    // compare demand against hours the scheduler can never actually use, and the
    // warning would never fire.
    const minutesByDay = new Map<string, number>();

    for (const slot of slots) {
      const startMs = new Date(slot.start).getTime();
      if (startMs >= deadlineMs) break;

      const usable = Math.min(new Date(slot.end).getTime(), deadlineMs) - startMs;
      const used = minutesByDay.get(slot.dateOnly) ?? 0;
      if (used >= dailyCap) continue;

      minutesByDay.set(slot.dateOnly, used + Math.min(usable, dailyCap - used));
    }

    let available = 0;
    for (const minutes of minutesByDay.values()) available += minutes;

    const due = candidates.filter(
      (candidate) => new Date(candidate.deadline).getTime() <= deadlineMs,
    );
    const demanded = due.reduce((total, candidate) => total + candidate.remainingMinutes, 0);

    if (demanded > available) {
      return {
        deadline,
        availableMinutes: available,
        demandedMinutes: demanded,
        tasks: due.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          minutes: candidate.remainingMinutes,
        })),
      };
    }
  }

  return null;
}
