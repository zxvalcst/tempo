import type { OnboardingInput } from "@/lib/types";

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