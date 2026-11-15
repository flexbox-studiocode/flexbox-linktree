/**
 * Timezone-aware reporting helpers.
 *
 * Every reporting boundary is derived from the configured timezone instead of a
 * hardcoded offset. `Asia/Jakarta` has observed a fixed UTC+07:00 offset since
 * 1964 and applies no daylight saving, but the offset is still resolved through
 * `Intl.DateTimeFormat` so a tz-database change cannot silently shift a report.
 */

export const REPORTING_TIME_ZONE = "Asia/Jakarta";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);

  return formatter;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** Effective offset of `timeZone` at `instant`, in milliseconds east of UTC. */
export function zoneOffsetMs(instant: Date, timeZone: string = REPORTING_TIME_ZONE): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Local calendar day of an instant, as `YYYY-MM-DD`. */
export function dayKeyOf(instant: Date, timeZone: string = REPORTING_TIME_ZONE): string {
  const parts = zonedParts(instant, timeZone);

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates a `YYYY-MM-DD` day key without accepting rollover dates. */
export function isDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function splitDayKey(dayKey: string): { year: number; month: number; day: number } {
  const match = DAY_KEY.exec(dayKey);

  if (!match) {
    throw new Error(`Invalid day key: ${dayKey}`);
  }

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function joinDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** UTC instant at which the Jakarta day `dayKey` starts. */
export function startOfDayUtc(dayKey: string, timeZone: string = REPORTING_TIME_ZONE): Date {
  const { year, month, day } = splitDayKey(dayKey);
  const naive = Date.UTC(year, month - 1, day);

  // Two passes: the first estimate can land in a different offset period.
  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);

  return new Date(naive - zoneOffsetMs(new Date(firstGuess), timeZone));
}

/** UTC instant at which the day after `dayKey` starts (exclusive range end). */
export function endOfDayExclusiveUtc(dayKey: string, timeZone: string = REPORTING_TIME_ZONE): Date {
  return startOfDayUtc(addDays(dayKey, 1), timeZone);
}

export function addDays(dayKey: string, days: number): string {
  const { year, month, day } = splitDayKey(dayKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return joinDayKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function compareDayKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function dayKeyDistance(from: string, to: string): number {
  const start = splitDayKey(from);
  const end = splitDayKey(to);
  const millis =
    Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day);

  return Math.round(millis / 86_400_000);
}

/** Inclusive list of day keys between two bounds. */
export function enumerateDays(from: string, to: string, limit = 400): string[] {
  const days: string[] = [];
  let cursor = from;

  while (compareDayKeys(cursor, to) <= 0 && days.length < limit) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

/**
 * ISO week bucket key for a day, using Monday as the first day of the week.
 * Rendering uses `startOfIsoWeek` so weekly trend labels are readable.
 */
export function isoWeekBucket(dayKey: string): string {
  const { year, month, day } = splitDayKey(dayKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - weekday * 86_400_000);

  return joinDayKey(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

export function monthBucket(dayKey: string): string {
  const { year, month } = splitDayKey(dayKey);

  return `${year}-${pad(month)}`;
}

/** Converts a day key into the `Date` value Prisma expects for a `date` column. */
export function dayKeyToDate(dayKey: string): Date {
  const { year, month, day } = splitDayKey(dayKey);

  return new Date(Date.UTC(year, month - 1, day));
}

export function dateToDayKey(value: Date): string {
  return joinDayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}