import { DAY_NAMES } from "@/lib/types";

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