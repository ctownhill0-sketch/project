// Google Places pricing and caps (finder spec §1.2, §3). The single source for every figure the UI shows.
// Checked 2026-09-29 against Google's pricing pages (see spec §1.5). If Google changes prices, edit here only.

export type PlacesSku = "text_search_enterprise" | "text_search_ids" | "place_details_atmosphere";

export const PLACES_PRICING: Record<PlacesSku, { label: string; usdPer1000: number; freePerMonth: number }> =
  {
    text_search_enterprise: { label: "Text Search Enterprise", usdPer1000: 35, freePerMonth: 1000 },
    text_search_ids: {
      label: "Text Search Essentials (IDs only)",
      usdPer1000: 0,
      freePerMonth: Number.POSITIVE_INFINITY,
    },
    place_details_atmosphere: {
      label: "Place Details Enterprise + Atmosphere",
      usdPer1000: 25,
      freePerMonth: 1000,
    },
  };

export const PRICING_CHECKED_ON = "2026-09-29";

/** Google returns up to 20 results a page; we budget for 3 pages a query. */
export const PAGES_PER_QUERY = 3;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Cost of `requests` more calls this month, after the free monthly usage (this app's usage only). */
export function costAfterFree(sku: PlacesSku, requests: number, usedThisMonth: number): number {
  const { usdPer1000, freePerMonth } = PLACES_PRICING[sku];
  const freeLeft = Math.max(0, freePerMonth - usedThisMonth);
  const billable = Math.max(0, requests - freeLeft);
  return round((billable * usdPer1000) / 1000);
}

export function estimateRun({
  towns,
  keywords,
  usedThisMonth,
}: {
  towns: number;
  keywords: number;
  usedThisMonth: number;
}) {
  const queries = towns * keywords;
  const maxRequests = queries * PAGES_PER_QUERY;
  const listCostUsd = round((maxRequests * PLACES_PRICING.text_search_enterprise.usdPer1000) / 1000);
  return {
    queries,
    maxRequests,
    listCostUsd,
    costAfterFreeUsd: costAfterFree("text_search_enterprise", maxRequests, usedThisMonth),
  };
}

export interface Caps {
  daily: number;
  monthly: number;
}

export const DEFAULT_CAPS: { search: Caps; details: Caps } = {
  search: { daily: 100, monthly: 900 },
  details: { daily: 20, monthly: 200 },
};

export type CapResult = { ok: true } | { ok: false; which: "daily" | "monthly"; message: string };

export function capCheck(used: { today: number; month: number }, caps: Caps): CapResult {
  if (used.today >= caps.daily) {
    return {
      ok: false,
      which: "daily",
      message: `Daily cap of ${caps.daily} Google requests reached. Nothing more will be sent today. Change it in Settings.`,
    };
  }
  if (used.month >= caps.monthly) {
    return {
      ok: false,
      which: "monthly",
      message: `Monthly cap of ${caps.monthly} Google requests reached. Nothing more will be sent this month. Change it in Settings.`,
    };
  }
  return { ok: true };
}
