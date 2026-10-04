/**
 * Shared types mirroring `supabase/schema.sql`.
 *
 * When the schema changes, this file changes with it — see CONSTRAINTS.md rule 5.
 *
 * Time convention: Postgres `time` columns (`sleep_start`, `sleep_end`,
 * `earliest_class_time`) are returned by PostgREST as "HH:MM:SS". An HTML
 * `<input type="time">` only accepts "HH:MM", so run every value through
 * `toHhMm()` before binding it to a form control.
 *
 * A sleep window may cross midnight (23:00 -> 06:00 is valid); only equal
 * start and end is rejected. This is deliberately NOT the `commitments` rule,
 * whose CHECK constraint requires `end_time > start_time`.
 */

export type Profile = {
  id: string;
  name: string | null;
  timezone: string;
  sleep_start: string;
  sleep_end: string;
  earliest_class_time: string | null;
  work_hours_per_day: number;
  pace_factor: number;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
};

export type OnboardingInput = {
  timezone: string;
  sleep_start: string;
  sleep_end: string;
  earliest_class_time: string | null;
  work_hours_per_day: number;
  /** Only sent by the settings form. Omitted on onboarding so a save there
   *  can never clear an existing name. */
  name?: string;
};

/** Mirrors the column defaults in `schema.sql`. */
export const ONBOARDING_DEFAULTS: OnboardingInput = {
  timezone: "Asia/Jakarta",
  sleep_start: "23:00",
  sleep_end: "06:00",
  earliest_class_time: null,
  work_hours_per_day: 4,
};

/** "23:00:00" -> "23:00". Leaves an already-short value untouched. */
export function toHhMm(value: string): string {
  return value.slice(0, 5);
}