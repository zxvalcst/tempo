import {
  addDaysTo,
  dateOnlyIn,
  localSegments,
  localMinutes,
  minutesFromHhMm,
  weekdayOfDateOnly,
  zonedTimeToUtc,
} from "@/lib/dates";
import type { Commitment, Profile, Session } from "@/lib/types";

/** A rolling week. Only tasks due inside it are planned. */
export const HORIZON_DAYS = 7;

/** A gap shorter than this is not worth offering. */
export const MIN_SLOT_MINUTES = 30;

/** Sessions are 30 to 120 minutes. */
export const MIN_SESSION_MINUTES = 30;
export const MAX_SESSION_MINUTES = 120;

/** All session boundaries land on half hours, so gaps stay reusable. */
export const SESSION_GRANULARITY_MINUTES = 30;

export type FreeSlot = {
  /** ISO instant, UTC. */
  start: string;
  /** ISO instant, UTC. */
  end: string;
  /** The local date this slot belongs to, for the daily hour cap. */
  dateOnly: string;
};

/** A span in local wall-clock minutes past midnight. */
type Interval = { from: number; to: number };

/**
 * The only statuses that block time. `moved` because the user placed them,
 * `done` because they already happened. `skipped` is terminal history that
 * neither blocks nor gets re-planned.
 *
 * Filtered here rather than trusted from the caller, so the rule cannot be
 * broken by passing the wrong set of sessions.
 */
const BLOCKING_STATUSES: Session["status"][] = ["moved", "done"];

/**
 * The waking spans of one local day.
 *
 * Both sleep shapes are legal — the schema rejects only equal start and end.
 * Which one you have decides whether waking time is one span or two:
 *
 * - 23:00 -> 06:00: sleep runs across midnight, so waking is [06:00, 23:00).
 * - 01:00 -> 09:00: sleep sits inside the day, so waking is [00:00, 01:00)
 *   plus [09:00, 24:00).
 *
 * Assuming only the first shape would schedule study through the middle of the
 * night for anyone who naps, so both are handled.
 */
export function wakingIntervals(profile: Profile): Interval[] {
  const sleepStart = minutesFromHhMm(profile.sleep_start);
  const sleepEnd = minutesFromHhMm(profile.sleep_end);

  if (sleepStart > sleepEnd) return [{ from: sleepEnd, to: sleepStart }];

  return [
    { from: 0, to: sleepStart },
    { from: sleepEnd, to: 1440 },
  ];
}

/** The sleeping spans of one local day — the complement of waking time. */
export function sleepingIntervals(profile: Profile): Interval[] {
  const sleepStart = minutesFromHhMm(profile.sleep_start);
  const sleepEnd = minutesFromHhMm(profile.sleep_end);

  if (sleepStart > sleepEnd) {
    return [
      { from: sleepStart, to: 1440 },
      { from: 0, to: sleepEnd },
    ];
  }

  return [{ from: sleepStart, to: sleepEnd }];
}

/** Removes every `cut` from `base`, preserving chronological order. */
function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  let current = base;

  for (const cut of cuts) {
    const next: Interval[] = [];

    for (const piece of current) {
      // No overlap.
      if (cut.to <= piece.from || cut.from >= piece.to) {
        next.push(piece);
        continue;
      }

      if (cut.from > piece.from) next.push({ from: piece.from, to: cut.from });
      if (cut.to < piece.to) next.push({ from: cut.to, to: piece.to });
    }

    current = next;
  }

  return current;
}

/**
 * Every free slot for the next 7 days in the user's own timezone: waking hours,
 * minus the sleep window, minus commitments (recurring and one-off), minus the
 * `moved` and `done` sessions that must never move.
 *
 * `work_hours_per_day` is *not* applied here. Slots are the ceiling; the
 * scheduler stops filling a day once it reaches the limit, which keeps work
 * landing earlier in the day rather than spread to the last waking minute.
 */
export function findFreeSlots(
  profile: Profile,
  commitments: Commitment[],
  fixedSessions: Session[],
  now: Date = new Date(),
): FreeSlot[] {
  const timeZone = profile.timezone;
  const firstDate = dateOnlyIn(timeZone, now);
  const waking = wakingIntervals(profile);
  const slots: FreeSlot[] = [];

  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const dateOnly = addDaysTo(firstDate, offset);
    const weekday = weekdayOfDateOnly(dateOnly);

    const dayCommitments = commitments.filter((commitment) =>
      commitment.is_recurring
        ? commitment.day_of_week === weekday
        : commitment.specific_date === dateOnly,
    );

    const cuts: Interval[] = dayCommitments.map((commitment) => ({
      from: minutesFromHhMm(commitment.start_time),
      to: minutesFromHhMm(commitment.end_time),
    }));

    // Fixed sessions, clipped to this local day. Clipping through
    // `localSegments` is what makes a session spanning local midnight subtract
    // from both days instead of one or the other.
    for (const session of fixedSessions) {
      if (!BLOCKING_STATUSES.includes(session.status)) continue;

      for (const segment of localSegments(
        new Date(session.planned_start),
        new Date(session.planned_end),
        timeZone,
      )) {
        if (segment.dateOnly === dateOnly) cuts.push({ from: segment.from, to: segment.to });
      }
    }

    // Nothing may be planned in the part of today that has already passed.
    // `localMinutes` truncates to the minute, so a now of 10:30:00.500 would
    // otherwise still offer a 10:30 start. Round up to the next half-hour
    // boundary only when the boundary itself is already in the past.
    if (offset === 0) {
      const nowLocalMinutes = localMinutes(now, timeZone);
      const boundaryInstant = zonedTimeToUtc(dateOnly, nowLocalMinutes, timeZone);
      const cutTo =
        boundaryInstant.getTime() < now.getTime()
          ? Math.ceil(nowLocalMinutes / SESSION_GRANULARITY_MINUTES) * SESSION_GRANULARITY_MINUTES
          : nowLocalMinutes;

      cuts.push({ from: 0, to: cutTo });
    }

    // Before an early class, no work. A "morning with a class" means a
    // commitment categorised as a class.
    const hasClass = dayCommitments.some((commitment) => commitment.category === "class");
    const earliestClass = profile.earliest_class_time
      ? minutesFromHhMm(profile.earliest_class_time)
      : null;

    const base =
      hasClass && earliestClass !== null
        ? waking.map((piece) => ({ from: Math.max(piece.from, earliestClass), to: piece.to }))
        : waking;

    for (const piece of subtract(base, cuts)) {
      if (piece.to - piece.from < MIN_SLOT_MINUTES) continue;

      const start = zonedTimeToUtc(dateOnly, piece.from, timeZone);
      const end = zonedTimeToUtc(dateOnly, piece.to, timeZone);

      // A DST gap can collapse a span to nothing or invert it.
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end.getTime() <= start.getTime()) continue;

      slots.push({ start: start.toISOString(), end: end.toISOString(), dateOnly });
    }
  }

  return slots;
}

/** True when `[start, end)` overlaps any of `blocks`, all UTC instants. */
export function overlapsAny(
  start: Date,
  end: Date,
  blocks: Array<{ start: string; end: string }>,
): boolean {
  const from = start.getTime();
  const to = end.getTime();

  return blocks.some((block) => from < new Date(block.end).getTime() && to > new Date(block.start).getTime());
}
