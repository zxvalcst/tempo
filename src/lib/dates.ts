import { DAY_NAMES } from "@/lib/types";

/**
 * "23:00:00" -> "23:00". PostgREST returns every `time` column with seconds,
 * and an `<input type="time">` only accepts "HH:MM". Leaves an already-short
 * value untouched.
 */
export function toHhMm(value: string): string {
  return value.slice(0, 5);
}

/** A deadline this close is flagged as due soon. */
export const DUE_SOON_HOURS = 48;

export type DueState = "overdue" | "soon" | "normal";

/**
 * Compute on the server and pass the result down. A client component deriving
 * this from its own clock would disagree with the server render.
 */
export function dueState(deadline: string, status: string): DueState {
  if (status === "done") return "normal";

  const remaining = new Date(deadline).getTime() - Date.now();

  if (Number.isNaN(remaining)) return "normal";
  if (remaining < 0) return "overdue";
  if (remaining <= DUE_SOON_HOURS * 60 * 60 * 1000) return "soon";

  return "normal";
}

/** `timestamptz` shown in the user's own zone. */
export function formatDeadline(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No deadline";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Postgres `date` columns arrive as "YYYY-MM-DD". Parsing that with `new Date()`
 * yields UTC midnight, which renders as the previous day in any negative-offset
 * zone, so these are formatted as UTC.
 */
export function formatDateOnly(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** `datetime-local` yields "YYYY-MM-DDTHH:mm" with no zone. */
export function toDateTimeLocalValue(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "Unknown";
}

/**
 * The user's own calendar date as "YYYY-MM-DD", which is the shape a Postgres
 * `date` column arrives in. Derived from the zone rather than from the server
 * clock, so someone west of UTC gets their own day.
 */
export function dateOnlyIn(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The weekday index (0 = Sunday) in the user's own zone. */
export function dayOfWeekIn(timeZone: string, at: Date = new Date()): number {
  // The date-only string is UTC midnight, so read the weekday back in UTC too.
  return new Date(`${dateOnlyIn(timeZone, at)}T00:00:00Z`).getUTCDay();
}

/** "Monday 6 October" in the user's own zone. */
export function formatToday(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}