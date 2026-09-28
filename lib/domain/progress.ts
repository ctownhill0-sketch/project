export interface KillTestSettings {
  day0: string; // YYYY-MM-DD (New York)
  deadline: string;
  pilotsTarget: number;
  conversationsTarget: number;
  afterHoursMedianMinutes: number;
}

export interface KillTestActuals {
  pilots: number;
  conversations: number;
  /** Metro after-hours median (no-replies counted as never). null = no data. */
  afterHoursMedianMinutes: number | null;
}

const DAY = 86_400_000;
const nyDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);

/** Day-90 kill test: day number, countdown and which goals are met. */
export function killTestProgress(s: KillTestSettings, now: Date, actual: KillTestActuals) {
  const today = nyDate(now);
  const sinceStart = daysBetween(s.day0, today);
  const started = sinceStart >= 0;
  return {
    started,
    startsInDays: started ? 0 : -sinceStart,
    day: started ? sinceStart : 0,
    totalDays: daysBetween(s.day0, s.deadline),
    daysLeft: daysBetween(today, s.deadline),
    pilots: actual.pilots,
    conversations: actual.conversations,
    afterHoursMedianMinutes: actual.afterHoursMedianMinutes,
    pilotsMet: actual.pilots >= s.pilotsTarget,
    conversationsMet: actual.conversations >= s.conversationsTarget,
    afterHoursMet:
      actual.afterHoursMedianMinutes === null
        ? null
        : actual.afterHoursMedianMinutes > s.afterHoursMedianMinutes,
  };
}

/** Growth from the second-to-last to the last value; null when unknown. */
export function weekOverWeek(series: number[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2] as number;
  const last = series[series.length - 1] as number;
  if (prev <= 0) return null;
  return (last - prev) / prev;
}

/** Latest value followed by `weeks` compounded steps at `rate`. */
export function projection(latest: number, weeks: number, rate: number): number[] {
  return Array.from({ length: weeks + 1 }, (_, i) => latest * (1 + rate) ** i);
}
