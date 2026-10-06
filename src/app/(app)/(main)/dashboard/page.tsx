import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { secondaryButtonClassName } from "@/components/form";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import {
  addDaysTo,
  dateOnlyIn,
  dayOfWeekIn,
  dueState,
  formatDeadline,
  formatToday,
  minutesFromHhMm,
  toHhMm,
  zonedTimeToUtc,
} from "@/lib/dates";
import { listCommitments } from "@/lib/data/commitments";
import { getProfile } from "@/lib/data/profile";
import {
  completedMinutesByTask,
  listFixedSessions,
  listSessionsInRange,
} from "@/lib/data/sessions";
import { listTasks } from "@/lib/data/tasks";
import { findOverload } from "@/lib/planner/schedule";
import type { Commitment, SessionStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard · Tempo",
};

const sessionChip: Record<SessionStatus, string> = {
  planned: "bg-accent-lavender",
  done: "bg-accent-sage",
  skipped: "bg-primary",
  moved: "bg-accent-sky",
};

/** One row of the Today list: a fixed commitment or a planned work session. */
type TodayItem = {
  key: string;
  start: number;
  startLabel: string;
  endLabel: string;
  title: string;
  subtitle: string;
  chip: string | null;
  chipLabel: string | null;
};

/** An instant as "HH:MM" in the user's own zone. */
function timeLabel(iso: string, timeZone: string): string {
  return toHhMm(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export default async function DashboardPage() {
  const [profile, commitments, tasks] = await Promise.all([
    getProfile(),
    listCommitments(),
    listTasks(),
  ]);

  if (!profile) redirect("/onboarding");

  const timeZone = profile.timezone;
  const todayDate = dateOnlyIn(timeZone);

  // A commitment belongs to today if it recurs on today's weekday, or if it is a
  // one-off dated today. Both are resolved in the user's own zone.
  const today = dayOfWeekIn(timeZone);

  const todaysCommitments = commitments.filter(
    (commitment: Commitment) =>
      commitment.is_recurring && commitment.day_of_week !== null
        ? commitment.day_of_week === today
        : commitment.specific_date === todayDate,
  );

  // Today's sessions, bounded by the user's local midnight rather than UTC's.
  const dayStart = zonedTimeToUtc(todayDate, 0, timeZone).toISOString();
  const dayEnd = zonedTimeToUtc(addDaysTo(todayDate, 1), 0, timeZone).toISOString();

  const [todaysSessions, fixedSessions, completed] = await Promise.all([
    listSessionsInRange(dayStart, dayEnd),
    listFixedSessions(),
    completedMinutesByTask(),
  ]);

  const todayItems: TodayItem[] = [
    ...todaysCommitments.map((commitment) => ({
      key: `commitment-${commitment.id}`,
      start: zonedTimeToUtc(
        todayDate,
        minutesFromHhMm(commitment.start_time),
        timeZone,
      ).getTime(),
      startLabel: toHhMm(commitment.start_time),
      endLabel: toHhMm(commitment.end_time),
      title: commitment.title,
      subtitle: commitment.category,
      chip: null,
      chipLabel: null,
    })),
    ...todaysSessions.map((session) => ({
      key: `session-${session.id}`,
      start: new Date(session.planned_start).getTime(),
      startLabel: timeLabel(session.planned_start, timeZone),
      endLabel: timeLabel(session.planned_end, timeZone),
      title: session.task_title,
      subtitle: session.ai_reason ?? "Planned automatically",
      chip: sessionChip[session.status],
      chipLabel: session.status,
    })),
  ].sort((a, b) => a.start - b.start);

  // `dueState` already skips finished tasks, so this is overdue plus due soon.
  const needsAttention = tasks.filter((task) => dueState(task.deadline, task.status) !== "normal");

  const overload = findOverload(profile, tasks, commitments, fixedSessions, completed);

  const rows: Array<[string, string]> = [
    ["Time zone", profile.timezone],
    ["Sleep window", `${toHhMm(profile.sleep_start)} to ${toHhMm(profile.sleep_end)}`],
    [
      "Earliest class",
      profile.earliest_class_time ? toHhMm(profile.earliest_class_time) : "None",
    ],
    ["Max work hours per day", String(Number(profile.work_hours_per_day))],
    ["Pace factor", String(Number(profile.pace_factor))],
  ];

  const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {profile.name ? `Welcome back, ${profile.name}` : "Welcome to Tempo"}
          </h1>
          <p className="mt-1 text-base text-muted">
            {formatToday(timeZone)}. Here is what needs you today.
          </p>
        </div>

        <GeneratePlanButton />
      </div>

      {overload ? (
        <section className="rounded-card border border-line bg-danger p-5 shadow-soft">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Overloaded before {formatDeadline(overload.deadline, timeZone)}
          </h2>
          <p className="mt-2 text-sm text-ink">
            {overload.tasks.length === 1
              ? "1 task needs"
              : `${overload.tasks.length} tasks need`}{" "}
            <strong>{hours(overload.demandedMinutes)}h</strong> but only{" "}
            <strong>{hours(overload.availableMinutes)}h</strong> is free. Some of it will not fit
            before the deadline — split the work, move a deadline, or drop something.
          </p>
          <ul className="mt-3 space-y-1">
            {overload.tasks.map((task) => (
              <li key={task.id} className="text-sm text-ink">
                <Link href={`/tasks/${task.id}`} className="underline underline-offset-2">
                  {task.title}
                </Link>{" "}
                — {hours(task.minutes)}h
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-card border border-line bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
            Today
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/commitments" className={secondaryButtonClassName()}>
              All commitments
            </Link>
            <Link href="/tasks" className={secondaryButtonClassName()}>
              All tasks
            </Link>
          </div>
        </div>

        {todayItems.length === 0 ? (
          <p className="mt-4 text-sm text-muted-strong">
            Nothing scheduled today. Generate a plan, or add a commitment.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {todayItems.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    {item.chip && item.chipLabel ? (
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs font-medium text-ink ${item.chip}`}
                      >
                        {item.chipLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-strong">{item.subtitle}</p>
                </div>
                <p className="shrink-0 text-sm font-medium text-ink">
                  {item.startLabel} to {item.endLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
            Needs attention
          </h2>
          <Link href="/tasks" className={secondaryButtonClassName()}>
            All tasks
          </Link>
        </div>

        {needsAttention.length === 0 ? (
          <p className="mt-4 text-sm text-muted-strong">
            Nothing is overdue or due in the next two days. You are clear.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {needsAttention.map((task) => {
              const overdue = dueState(task.deadline, task.status) === "overdue";

              return (
                <li key={task.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                    <p className="text-sm text-muted-strong">{task.course_name ?? "No course"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`rounded-pill px-2 py-0.5 text-xs font-medium text-ink ${
                        overdue ? "bg-danger" : "bg-primary"
                      }`}
                    >
                      {overdue ? "Overdue" : "Due soon"}
                    </span>
                    <span className="text-xs text-muted-strong">
                      {formatDeadline(task.deadline, timeZone)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-card p-6 shadow-soft">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
          Your settings
        </h2>
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <dt className="text-muted-strong">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/settings"
          className="mt-5 inline-block rounded-pill border border-line-strong bg-card px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-primary/40"
        >
          Edit settings
        </Link>
      </section>
    </div>
  );
}
