import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { secondaryButtonClassName } from "@/components/form";
import {
  dateOnlyIn,
  dayOfWeekIn,
  dueState,
  formatDeadline,
  formatToday,
  toHhMm,
} from "@/lib/dates";
import { listCommitments } from "@/lib/data/commitments";
import { getProfile } from "@/lib/data/profile";
import { listTasks } from "@/lib/data/tasks";
import type { Commitment } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard · Tempo",
};

export default async function DashboardPage() {
  const [profile, commitments, tasks] = await Promise.all([
    getProfile(),
    listCommitments(),
    listTasks(),
  ]);

  if (!profile) redirect("/onboarding");

  const timeZone = profile.timezone;

  // A commitment belongs to today if it recurs on today's weekday, or if it is a
  // one-off dated today. Both are resolved in the user's own zone.
  const today = dayOfWeekIn(timeZone);
  const todayDate = dateOnlyIn(timeZone);

  const todaysCommitments = commitments
    .filter((commitment) =>
      commitment.is_recurring && commitment.day_of_week !== null
        ? commitment.day_of_week === today
        : commitment.specific_date === todayDate,
    )
    .sort((a: Commitment, b: Commitment) => a.start_time.localeCompare(b.start_time));

  // `dueState` already skips finished tasks, so this is overdue plus due soon.
  const needsAttention = tasks.filter((task) => dueState(task.deadline, task.status) !== "normal");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {profile.name ? `Welcome back, ${profile.name}` : "Welcome to Tempo"}
        </h1>
        <p className="mt-1 text-base text-muted">
          {formatToday(timeZone)}. Here is what needs you today.
        </p>
      </div>

      <section className="rounded-card border border-line bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
            Today
          </h2>
          <Link href="/commitments" className={secondaryButtonClassName()}>
            All commitments
          </Link>
        </div>

        {todaysCommitments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-strong">
            Nothing scheduled today. Your fixed blocks show up here on the day they happen.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {todaysCommitments.map((commitment) => (
              <li key={commitment.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{commitment.title}</p>
                  <p className="text-sm text-muted-strong">{commitment.category}</p>
                </div>
                <p className="shrink-0 text-sm font-medium text-ink">
                  {toHhMm(commitment.start_time)} to {toHhMm(commitment.end_time)}
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
                    <p className="text-sm text-muted-strong">
                      {task.course_name ?? "No course"}
                    </p>
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