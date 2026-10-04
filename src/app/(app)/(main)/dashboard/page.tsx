import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { toHhMm } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard · Tempo",
};

export default async function DashboardPage() {
  const profile = await getProfile();

  if (!profile) redirect("/onboarding");

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
          Your week is ready to plan. Add your tasks next to get a schedule.
        </p>
      </div>

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
