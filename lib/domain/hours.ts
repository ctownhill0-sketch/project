export type HoursBucket = "business" | "saturday" | "after_hours";

export interface BusinessHours {
  timeZone: string;
  /** ISO weekdays counted as business days: 1 = Monday … 7 = Sunday. */
  days: number[];
  /** Local "HH:MM", start inclusive, end exclusive. */
  start: string;
  end: string;
  /** Founder choice B: Saturday is its own bucket. */
  saturdayBucket: boolean;
  holidaysAreAfterHours: boolean;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timeZone: "America/New_York",
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
  saturdayBucket: true,
  holidaysAreAfterHours: true,
};

interface LocalParts {
  date: string; // YYYY-MM-DD
  isoWeekday: number;
  minutes: number; // minutes since local midnight
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Wall-clock parts in the given zone. Intl applies daylight saving for us. */
function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    isoWeekday: WEEKDAYS[parts.weekday ?? ""] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function hoursBucket(sentAt: Date, hours: BusinessHours = DEFAULT_BUSINESS_HOURS): HoursBucket {
  const local = localParts(sentAt, hours.timeZone);
  if (hours.saturdayBucket && local.isoWeekday === 6) return "saturday";
  if (hours.holidaysAreAfterHours && isUsFederalHoliday(local.date)) return "after_hours";
  const inDay = hours.days.includes(local.isoWeekday);
  const inTime = local.minutes >= toMinutes(hours.start) && local.minutes < toMinutes(hours.end);
  return inDay && inTime ? "business" : "after_hours";
}

// ---- US federal holidays (OPM rules, including Saturday→Friday / Sunday→Monday observance) ----

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Day of month of the nth given weekday (0 = Sunday) in a month; n = -1 means last. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDay = new Date(Date.UTC(year, month - 1, lastDate)).getUTCDay();
  return lastDate - ((lastDay - weekday + 7) % 7);
}

function observed(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay();
  if (dow === 6) date.setUTCDate(day - 1);
  if (dow === 0) date.setUTCDate(day + 1);
  return date.toISOString().slice(0, 10);
}

function holidaysFor(year: number): string[] {
  return [
    observed(year, 1, 1),
    iso(year, 1, nthWeekday(year, 1, 1, 3)), // Martin Luther King Jr. Day
    iso(year, 2, nthWeekday(year, 2, 1, 3)), // Washington's Birthday
    iso(year, 5, nthWeekday(year, 5, 1, -1)), // Memorial Day
    observed(year, 6, 19), // Juneteenth
    observed(year, 7, 4),
    iso(year, 9, nthWeekday(year, 9, 1, 1)), // Labor Day
    iso(year, 10, nthWeekday(year, 10, 1, 2)), // Columbus Day
    observed(year, 11, 11), // Veterans Day
    iso(year, 11, nthWeekday(year, 11, 4, 4)), // Thanksgiving
    observed(year, 12, 25),
  ];
}

const cache = new Map<number, Set<string>>();

export function isUsFederalHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  // New Year's Day of next year can be observed on Dec 31 of this year.
  for (const y of [year, year + 1]) {
    if (!cache.has(y)) cache.set(y, new Set(holidaysFor(y)));
    if (cache.get(y)?.has(date)) return true;
  }
  return false;
}
