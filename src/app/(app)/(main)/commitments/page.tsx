import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommitmentRow } from "@/components/CommitmentRow";
import { dayName, formatDateOnly } from "@/lib/dates";
import { listCommitments } from "@/lib/data/commitments";
import { getProfile } from "@/lib/data/profile";
import type { Commitment } from "@/lib/types";

export const metadata: Metadata = {
  title: "Commitments · Tempo",
};

/** Monday-first: a class schedule reads better starting on Monday. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function CommitmentsPage() {
  const [profile, commitments] = await Promise.all([getProfile(), listCommitments()]);

  if (!profile) redirect("/onboarding");

  const recurring = commitments.filter(
    (commitment) => commitment.is_recurring && commitment.day_of_week !== null,
  );
  const oneOffs = commitments.filter(
    (commitment) => !commitment.is_recurring && commitment.specific_date !== null,
  );

  const byStartTime = (a: Commitment, b: Commitment) => a.start_time.localeCompare(b.start_time);

  const days = DAY_ORDER.map((day) => ({
    day,
    items: recurring.filter((commitment) => commitment.day_of_week === day).sort(byStartTime),
  })).filter((group) => group.items.length > 0);

  const oneOffDates = [
    ...new Set(oneOffs.map((commitment) => commitment.specific_date)),
  ].sort() as string[];

  const datedGroups = oneOffDates.map((date) => ({
    date,
    items: oneOffs.filter((commitment) => commitment.specific_date === date).sort(byStartTime),
  }));

  const total = recurring.length + oneOffs.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Commitments</h1>
          <p className="mt-1 text-base text-muted">
            Classes, meetings, and anything else that holds a fixed slot.
          </p>
        </div>

        <Link
          href="/commitments/new"
          className="rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
        >
          Add commitment
        </Link>
      </div>

      {total === 0 ? (
        <section className="rounded-card border border-line bg-card p-7 text-center shadow-soft">
          <h2 className="text-base font-semibold text-ink">Nothing fixed yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-strong">
            Add your classes and recurring meetings. The planner schedules around them and never
            moves them.
          </p>
          <Link
            href="/commitments/new"
            className="mt-5 inline-block rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105"
          >
            Add your first commitment
          </Link>
        </section>
      ) : (
        <div className="space-y-6">
          {days.map((group) => (
            <section
              key={group.day}
              className="rounded-card border border-line bg-card p-5 shadow-soft"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
                {dayName(group.day)}
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {group.items.map((commitment) => (
                  <CommitmentRow key={commitment.id} commitment={commitment} />
                ))}
              </ul>
            </section>
          ))}

          {datedGroups.map((group) => (
            <section
              key={group.date}
              className="rounded-card border border-line bg-card p-5 shadow-soft"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-strong">
                {formatDateOnly(group.date)}
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {group.items.map((commitment) => (
                  <CommitmentRow key={commitment.id} commitment={commitment} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}