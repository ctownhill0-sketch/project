import { DEFAULT_BUSINESS_HOURS } from "@/lib/domain/hours";
import { PRICING } from "@/lib/domain/pipeline";
import { DEFAULT_WEIGHTS } from "@/lib/domain/scoring";

/** Settings used until the founder saves their own (and seeded on first setup). */
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  metros: ["New York metro"],
  businessHours: DEFAULT_BUSINESS_HOURS,
  killTest: {
    day0: "2026-09-29",
    deadline: "2026-12-28",
    pilotsTarget: 3,
    conversationsTarget: 60,
    afterHoursMedianMinutes: 10,
  },
  scoringWeights: DEFAULT_WEIGHTS,
  guarantee: { tourTarget: 5, medianReplySeconds: 60, atRiskFromDay: 7, pilotDays: 14 },
  pricing: PRICING,
  growth: { weeklyTarget: 0.07, startsAfterClients: 3 },
  ycReadiness: { mrrLow: 8000, mrrHigh: 15000, clients: 10 },
  callBlocks: { days: [2, 3, 4], start: "09:00", end: "11:30" },
  brand: { wordmark: "Vacancy Desk" },
};
