/**
 * Shared types mirroring `supabase/schema.sql`.
 *
 * When the schema changes, this file changes with it — see CONSTRAINTS.md rule 5.
 *
 * Time convention: Postgres `time` columns (`sleep_start`, `sleep_end`,
 * `earliest_class_time`) are returned by PostgREST as "HH:MM:SS". An HTML
 * `<input type="time">` only accepts "HH:MM", so run every value through
 * `toHhMm()` from `dates.ts` before binding it to a form control.
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

/* ---------- courses ---------- */

export type Course = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

/* ---------- tasks ---------- */

export const TASK_TYPES = ["assignment", "project", "exam", "quiz", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  type: TaskType;
  deadline: string;
  grade_weight: number;
  difficulty: number;
  estimated_hours: number;
  priority_override: number | null;
  is_group: boolean;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** A task plus the course name resolved for display. */
export type TaskWithCourse = Task & {
  course_name: string | null;
};

export type TaskInput = {
  title: string;
  course_id: string | null;
  type: TaskType;
  deadline: string;
  grade_weight: number;
  difficulty: number;
  estimated_hours: number;
  is_group: boolean;
  status: TaskStatus;
};

/* ---------- commitments ---------- */

export const COMMITMENT_CATEGORIES = ["class", "org", "church", "committee", "other"] as const;
export type CommitmentCategory = (typeof COMMITMENT_CATEGORIES)[number];

/** 0 = Sunday ... 6 = Saturday, matching JavaScript `Date.getDay()`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Commitment = {
  id: string;
  user_id: string;
  title: string;
  category: CommitmentCategory;
  is_recurring: boolean;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type CommitmentInput = {
  title: string;
  category: CommitmentCategory;
  is_recurring: boolean;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
};