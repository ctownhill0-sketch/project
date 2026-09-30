// Pilot guarantee (brief M10). Per vacancy: about 5 tours and a median reply under 60 seconds within
// 14 days, or that vacancy's month is free. "At risk" is judged from day 7. Pure: no I/O.

export interface GuaranteeRules {
  tourTarget: number;
  medianReplySeconds: number;
  atRiskFromDay: number;
  pilotDays: number;
}

export const DEFAULT_GUARANTEE: GuaranteeRules = {
  tourTarget: 5,
  medianReplySeconds: 60,
  atRiskFromDay: 7,
  pilotDays: 14,
};

export interface DayMetric {
  inquiries: number;
  medianReplySeconds: number | null;
  tours: number;
}

export type GuaranteeStatus = "on_track" | "at_risk" | "met" | "missed";

const DAY = 86_400_000;

/** Whole calendar days from day 0 to today (both YYYY-MM-DD), immune to DST. */
export function daysElapsed(day0: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day0}T00:00:00Z`)) / DAY);
}

/** A calendar date (YYYY-MM-DD) moved by whole days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/**
 * Daily medians can't be combined exactly, so each day's median counts once per inquiry that day
 * (a day with no inquiries still counts once). Days without a median are left out.
 */
export function weightedMedianReply(days: DayMetric[]): number | null {
  const points = days
    .filter((d): d is DayMetric & { medianReplySeconds: number } => d.medianReplySeconds !== null)
    .map((d) => ({ value: d.medianReplySeconds, weight: Math.max(1, d.inquiries) }))
    .sort((a, b) => a.value - b.value);
  if (!points.length) return null;
  const half = points.reduce((sum, p) => sum + p.weight, 0) / 2;
  let running = 0;
  for (const p of points) {
    running += p.weight;
    if (running >= half) return p.value;
  }
  return points.at(-1)!.value;
}

export interface VacancyGuarantee {
  status: GuaranteeStatus;
  tours: number;
  projectedTours: number | null;
  medianReplySeconds: number | null;
  reasons: string[];
}

/**
 * `daysCovered` is how many pilot days have numbers (day 0 through the last entered day). When
 * today's entry is already in, it's one more than `elapsed`, and the projection divides by it so
 * the pace isn't overstated.
 */
export function vacancyGuarantee(
  days: DayMetric[],
  elapsed: number,
  rules: GuaranteeRules = DEFAULT_GUARANTEE,
  daysCovered = elapsed,
): VacancyGuarantee {
  const tours = days.reduce((sum, d) => sum + d.tours, 0);
  const median = weightedMedianReply(days);
  const divisor = Math.min(Math.max(elapsed, daysCovered), rules.pilotDays);
  const projected = divisor > 0 ? Math.round(((tours * rules.pilotDays) / divisor) * 10) / 10 : null;
  const base = { tours, projectedTours: projected, medianReplySeconds: median };
  const slow = median !== null && median > rules.medianReplySeconds;
  const slowReason = `Median reply is ${median}s, over ${rules.medianReplySeconds}s.`;

  if (elapsed >= rules.pilotDays) {
    const reasons: string[] = [];
    if (tours < rules.tourTarget) reasons.push(`${tours} tours, under the target of ${rules.tourTarget}.`);
    if (median === null) reasons.push("No reply times entered.");
    else if (slow) reasons.push(slowReason);
    return { ...base, status: reasons.length ? "missed" : "met", reasons };
  }
  if (elapsed < rules.atRiskFromDay) {
    return {
      ...base,
      status: "on_track",
      reasons: [`Too early to judge: at risk is checked from day ${rules.atRiskFromDay}.`],
    };
  }
  const reasons: string[] = [];
  if (projected !== null && projected < rules.tourTarget)
    reasons.push(`Tours project to ${projected}, under the target of ${rules.tourTarget}.`);
  if (slow) reasons.push(slowReason);
  return { ...base, status: reasons.length ? "at_risk" : "on_track", reasons };
}

/** A pilot is met only when every vacancy met the guarantee. */
export function pilotOutcome(statuses: GuaranteeStatus[]): "met" | "missed" {
  return statuses.length > 0 && statuses.every((s) => s === "met") ? "met" : "missed";
}
