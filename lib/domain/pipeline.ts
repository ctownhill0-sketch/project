export const PRICING = { perVacancy: 119, minimum: 400, setup: 300 } as const;

/** Monthly price: the greater of the minimum and vacancies × per-vacancy price. */
export function monthlyPrice(
  vacancies: number,
  pricing: { perVacancy: number; minimum: number } = PRICING,
): number {
  return Math.max(pricing.minimum, vacancies * pricing.perVacancy);
}

/** Expected MRR = monthly price × probability (brief M7). Rounded to cents. */
export function expectedMrr({ vacancies, probability }: { vacancies: number; probability: number }): number {
  if (!Number.isInteger(vacancies) || vacancies < 1) throw new Error("vacancies must be a whole number ≥ 1");
  if (probability < 0 || probability > 100) throw new Error("probability must be between 0 and 100");
  return Math.round(monthlyPrice(vacancies) * probability) / 100;
}
