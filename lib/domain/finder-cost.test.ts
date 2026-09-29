import { describe, expect, it } from "vitest";
import { capCheck, costAfterFree, DEFAULT_CAPS, estimateRun, PLACES_PRICING } from "@/lib/domain/finder-cost";

describe("pricing", () => {
  it("records the SKUs we use with list price and free monthly usage", () => {
    expect(PLACES_PRICING.text_search_enterprise).toMatchObject({ usdPer1000: 35, freePerMonth: 1000 });
    expect(PLACES_PRICING.place_details_atmosphere).toMatchObject({ usdPer1000: 25, freePerMonth: 1000 });
    expect(PLACES_PRICING.text_search_ids.usdPer1000).toBe(0);
  });

  it("charges only requests beyond the free monthly usage", () => {
    expect(costAfterFree("text_search_enterprise", 100, 0)).toBe(0);
    expect(costAfterFree("text_search_enterprise", 100, 950)).toBeCloseTo(1.75); // 50 × $0.035
    expect(costAfterFree("text_search_enterprise", 10, 2000)).toBeCloseTo(0.35);
    expect(costAfterFree("text_search_ids", 500, 0)).toBe(0);
  });
});

describe("estimateRun", () => {
  it("counts queries and the worst-case requests (3 pages each)", () => {
    const e = estimateRun({ towns: 2, keywords: 5, usedThisMonth: 0 });
    expect(e).toMatchObject({ queries: 10, maxRequests: 30, listCostUsd: 1.05, costAfterFreeUsd: 0 });
  });

  it("shows the cost after free usage when the month is nearly used up", () => {
    expect(estimateRun({ towns: 1, keywords: 5, usedThisMonth: 990 }).costAfterFreeUsd).toBeCloseTo(0.175);
  });
});

describe("capCheck", () => {
  it("allows requests under both caps", () => {
    expect(capCheck({ today: 99, month: 500 }, DEFAULT_CAPS.search)).toEqual({ ok: true });
  });

  it("stops at the daily cap with a clear message", () => {
    const r = capCheck({ today: 100, month: 500 }, DEFAULT_CAPS.search);
    expect(r).toMatchObject({ ok: false, which: "daily" });
    expect(!r.ok && r.message).toBe(
      "Daily cap of 100 Google requests reached. Nothing more will be sent today. Change it in Settings.",
    );
  });

  it("stops at the monthly cap", () => {
    const r = capCheck({ today: 3, month: 900 }, DEFAULT_CAPS.search);
    expect(r).toMatchObject({ ok: false, which: "monthly" });
    expect(!r.ok && r.message).toMatch(/Monthly cap of 900/);
  });

  it("keeps separate, lower defaults for review lookups", () => {
    expect(DEFAULT_CAPS.details).toEqual({ daily: 20, monthly: 200 });
  });
});
