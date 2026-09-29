// ROI calculator (brief M9). Every output is an estimate and is labeled "Estimated" in the UI.
import { monthlyPrice, PRICING } from "@/lib/domain/pipeline";

export interface RoiInputs {
  /** Monthly rent of a typical unit, dollars. */
  rent: number;
  /** Units that turn over (become vacant) in a year. */
  turnoversPerYear: number;
  /** Average days a unit sits vacant today. */
  daysVacant: number;
  /** Days faster to lease with instant replies (the founder's estimate). */
  daysFaster: number;
  /** Vacancies listed at the same time (sets the monthly price). */
  vacanciesAtOnce: number;
}

export const DEFAULT_ROI_INPUTS: RoiInputs = {
  rent: 1800,
  turnoversPerYear: 20,
  daysVacant: 30,
  daysFaster: 7,
  vacanciesAtOnce: 2,
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function roi(i: RoiInputs) {
  const daily = (i.rent * 12) / 365;
  const annualVacancyLoss = daily * i.daysVacant * i.turnoversPerYear;
  const annualSavings = daily * Math.min(i.daysFaster, i.daysVacant) * i.turnoversPerYear;
  const price = monthlyPrice(i.vacanciesAtOnce);
  const annualCost = price * 12 + PRICING.setup;
  const monthlySavings = annualSavings / 12;
  return {
    dailyCost: cents(daily),
    annualVacancyLoss: cents(annualVacancyLoss),
    annualSavings: cents(annualSavings),
    monthlyPrice: price,
    annualCost: cents(annualCost),
    netSavings: cents(annualSavings - annualCost),
    paybackMonths: monthlySavings > 0 ? annualCost / monthlySavings : null,
  };
}

const LIMITS: Record<keyof RoiInputs, [number, number]> = {
  rent: [100, 50_000],
  turnoversPerYear: [0, 10_000],
  daysVacant: [0, 365],
  daysFaster: [0, 365],
  vacanciesAtOnce: [1, 500],
};

export function roiQuery(i: RoiInputs): string {
  return new URLSearchParams(Object.entries(i).map(([k, v]) => [k, String(v)])).toString();
}

/** Inputs from a URL; anything missing or out of range falls back to the default. */
export function parseRoiQuery(q: URLSearchParams): RoiInputs {
  const out = { ...DEFAULT_ROI_INPUTS };
  for (const key of Object.keys(LIMITS) as (keyof RoiInputs)[]) {
    const raw = q.get(key);
    if (raw === null || !/^\d+(\.\d+)?$/.test(raw)) continue;
    const n = Number(raw);
    const [lo, hi] = LIMITS[key];
    if (n >= lo && n <= hi) out[key] = key === "rent" ? n : Math.round(n);
  }
  return out;
}
