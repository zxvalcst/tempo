import type { OnboardingInput } from "@/lib/types";
import {
  COMMITMENT_CATEGORIES,
  TASK_STATUSES,
  TASK_TYPES,
  type CommitmentInput,
  type TaskInput,
} from "@/lib/types";

export type FieldErrors = Record<string, string>;

export type AuthFormState = {
  errors?: FieldErrors;
  message?: string;
};

export type OnboardingFormState = {
  errors?: FieldErrors;
  message?: string;
  values?: OnboardingInput;
  saved?: boolean;
};

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export type Credentials = {
  email: string;
  password: string;
};

export function validateCredentials(input: Credentials): FieldErrors {
  const errors: FieldErrors = {};

  if (!EMAIL.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

export function validateSignUp(input: Credentials & { name: string }): FieldErrors {
  const errors = validateCredentials(input);

  if (input.name.trim().length === 0) {
    errors.name = "Enter your name.";
  }

  return errors;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirrors the CHECK constraints in `schema.sql`. The sleep window may cross
 * midnight, so start and end only have to differ — see types.ts.
 */
export function validateOnboarding(input: OnboardingInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!HH_MM.test(input.sleep_start)) {
    errors.sleep_start = "Use a 24-hour time like 23:00.";
  }
  if (!HH_MM.test(input.sleep_end)) {
    errors.sleep_end = "Use a 24-hour time like 06:00.";
  }
  if (!errors.sleep_start && !errors.sleep_end && input.sleep_start === input.sleep_end) {
    errors.sleep_end = "Sleep start and sleep end must be different.";
  }

  if (input.earliest_class_time !== null && !HH_MM.test(input.earliest_class_time)) {
    errors.earliest_class_time = "Use a 24-hour time like 08:00.";
  }

  const hours = Number(input.work_hours_per_day);
  if (!Number.isFinite(hours) || hours < 1 || hours > 16) {
    errors.work_hours_per_day = "Choose between 1 and 16 hours.";
  }

  if (!isValidTimeZone(input.timezone)) {
    errors.timezone = "Choose a time zone.";
  }

  return errors;
}

export function parseOnboardingForm(formData: FormData): OnboardingInput {
  const earliest = String(formData.get("earliest_class_time") ?? "").trim();

  return {
    timezone: String(formData.get("timezone") ?? "").trim(),
    sleep_start: String(formData.get("sleep_start") ?? "").trim(),
    sleep_end: String(formData.get("sleep_end") ?? "").trim(),
    earliest_class_time: earliest === "" ? null : earliest,
    work_hours_per_day: Number(formData.get("work_hours_per_day")),
    ...(formData.has("name")
      ? { name: String(formData.get("name") ?? "").trim() }
      : {}),
  };
}

/** The settings form also edits the display name, which cannot be blank. */
export function validateSettings(input: OnboardingInput): FieldErrors {
  const errors = validateOnboarding(input);

  if (input.name !== undefined && input.name.trim().length === 0) {
    errors.name = "Enter your name.";
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids arrive from the URL and form posts, so they are checked before any write. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/* ---------- tasks ---------- */

export type CrudFormState = {
  errors?: FieldErrors;
  message?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A past deadline is deliberately allowed, otherwise an overdue task could not
 * be edited — which is exactly when someone needs to edit it. The schema has no
 * such CHECK either, only `deadline not null`.
 */
export function validateTask(input: Omit<TaskInput, "course_id">): FieldErrors {
  const errors: FieldErrors = {};

  if (input.title.trim().length === 0) errors.title = "Give the task a title.";
  if (!TASK_TYPES.includes(input.type)) errors.type = "Choose a type.";
  if (!TASK_STATUSES.includes(input.status)) errors.status = "Choose a status.";

  if (!ISO_DATE.test(input.deadline) || Number.isNaN(new Date(input.deadline).getTime())) {
    errors.deadline = "Choose a deadline.";
  }

  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5) {
    errors.difficulty = "Choose 1 to 5.";
  }

  if (!Number.isFinite(input.grade_weight) || input.grade_weight < 0 || input.grade_weight > 100) {
    errors.grade_weight = "Enter 0 to 100.";
  }

  if (!Number.isFinite(input.estimated_hours) || input.estimated_hours <= 0) {
    errors.estimated_hours = "Enter more than 0.";
  }

  return errors;
}

/**
 * `course` is read separately by the action, which resolves a typed name to an
 * id through `resolveCourse`. Keeping it out of here means one code path for
 * picking an existing course and creating a new one.
 */
export function parseTaskForm(formData: FormData): Omit<TaskInput, "course_id"> {
  const rawDeadline = String(formData.get("deadline") ?? "").trim();
  const deadline = new Date(rawDeadline);
  const isGroup = formData.get("is_group") === "on";

  return {
    title: String(formData.get("title") ?? "").trim(),
    type: String(formData.get("type") ?? "") as TaskInput["type"],
    // `datetime-local` carries no zone, so it is resolved in the browser's own
    // zone and stored as the UTC instant. An unparseable value is passed
    // through untouched for `validateTask` to reject, rather than throwing here.
    deadline: Number.isNaN(deadline.getTime()) ? rawDeadline : deadline.toISOString(),
    grade_weight: Number(formData.get("grade_weight")),
    difficulty: Number(formData.get("difficulty")),
    estimated_hours: Number(formData.get("estimated_hours")),
    is_group: isGroup,
    status: String(formData.get("status") ?? "") as TaskInput["status"],
  };
}

/* ---------- commitments ---------- */

/** Unlike the sleep window, a commitment may not cross midnight. */
export function validateCommitment(input: CommitmentInput): FieldErrors {
  const errors: FieldErrors = {};

  if (input.title.trim().length === 0) errors.title = "Give it a title.";
  if (!COMMITMENT_CATEGORIES.includes(input.category)) errors.category = "Choose a category.";

  if (!HH_MM.test(input.start_time)) errors.start_time = "Use a 24-hour time like 08:00.";
  if (!HH_MM.test(input.end_time)) errors.end_time = "Use a 24-hour time like 10:00.";

  if (!errors.start_time && !errors.end_time && input.end_time <= input.start_time) {
    errors.end_time = "End must be after start.";
  }

  const hasDay = input.day_of_week !== null;
  const hasDate = input.specific_date !== null;

  if (input.is_recurring && !hasDay) errors.day_of_week = "Choose a day.";
  if (!input.is_recurring && !hasDate) errors.specific_date = "Choose a date.";

  return errors;
}

export function parseCommitmentForm(formData: FormData): CommitmentInput {
  const isRecurring = formData.get("is_recurring") === "on";
  const day = String(formData.get("day_of_week") ?? "").trim();
  const date = String(formData.get("specific_date") ?? "").trim();

  return {
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "") as CommitmentInput["category"],
    is_recurring: isRecurring,
    day_of_week: isRecurring && day !== "" ? Number(day) : null,
    specific_date: !isRecurring && date !== "" ? date : null,
    start_time: String(formData.get("start_time") ?? "").trim(),
    end_time: String(formData.get("end_time") ?? "").trim(),
  };
}