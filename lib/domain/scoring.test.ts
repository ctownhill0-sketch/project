import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, scoreLead, whyThisLead, type LeadFacts } from "@/lib/domain/scoring";

const base: LeadFacts = {
  software: "buildium",
  units: 180,
  liveListings: 14,
  isLocal: true,
  shop: { medianReplyMinutes: 252, anyNoReply: false, shopCount: 1 },
};

describe("scoreLead", () => {
  it("adds each rule that applies and explains it", () => {
    const r = scoreLead(base, DEFAULT_WEIGHTS);
    // not AppFolio 30 + 3–25 listings 20 + slow reply 25 + 50–500 units 15 + local 10
    expect(r.score).toBe(100);
    expect(r.breakdown.map((b) => b.rule)).toEqual([
      "notAppfolio",
      "listings3to25",
      "slowReply",
      "units50to500",
      "local",
    ]);
  });

  it("gives +20 only when no software is found, not when it's unknown", () => {
    expect(
      scoreLead({ ...base, software: "none", isLocal: false, units: null }, DEFAULT_WEIGHTS).breakdown.map(
        (b) => b.rule,
      ),
    ).toContain("noSoftware");
    expect(
      scoreLead({ ...base, software: "unknown" }, DEFAULT_WEIGHTS).breakdown.map((b) => b.rule),
    ).not.toContain("noSoftware");
  });

  it("scores AppFolio firms 0 and says why", () => {
    const r = scoreLead({ ...base, software: "appfolio" }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(0);
    expect(r.excluded).toBe(true);
    expect(r.breakdown).toEqual([{ rule: "appfolio", points: 0, reason: "On AppFolio (excluded)" }]);
  });

  it("counts a shop with no reply as slower than 2 hours", () => {
    const r = scoreLead(
      { ...base, shop: { medianReplyMinutes: 30, anyNoReply: true, shopCount: 2 } },
      DEFAULT_WEIGHTS,
    );
    expect(r.breakdown.map((b) => b.rule)).toContain("slowReply");
    expect(
      scoreLead(
        { ...base, shop: { medianReplyMinutes: 30, anyNoReply: false, shopCount: 2 } },
        DEFAULT_WEIGHTS,
      ).breakdown.map((b) => b.rule),
    ).not.toContain("slowReply");
    expect(scoreLead({ ...base, shop: null }, DEFAULT_WEIGHTS).breakdown.map((b) => b.rule)).not.toContain(
      "slowReply",
    );
  });

  it("respects the listing and unit boundaries", () => {
    const rules = (f: Partial<LeadFacts>) =>
      scoreLead({ ...base, ...f }, DEFAULT_WEIGHTS).breakdown.map((b) => b.rule);
    expect(rules({ liveListings: 3 })).toContain("listings3to25");
    expect(rules({ liveListings: 25 })).toContain("listings3to25");
    expect(rules({ liveListings: 2 })).not.toContain("listings3to25");
    expect(rules({ liveListings: 26 })).not.toContain("listings3to25");
    expect(rules({ units: 50 })).toContain("units50to500");
    expect(rules({ units: 501 })).not.toContain("units50to500");
    expect(rules({ units: null, liveListings: null })).not.toContain("units50to500");
  });

  it("uses edited weights and caps the total at 0–100", () => {
    const heavy = { ...DEFAULT_WEIGHTS, local: 90 };
    expect(scoreLead(base, heavy).score).toBe(100);
    const negative = { ...DEFAULT_WEIGHTS, notAppfolio: -200 };
    expect(scoreLead(base, negative).score).toBe(0);
  });
});

describe("whyThisLead", () => {
  it("summarises what we know in one line", () => {
    expect(whyThisLead(base)).toBe("Buildium, ~180 units, 14 listings, first reply 4h 12m");
  });

  it("never invents missing values", () => {
    expect(
      whyThisLead({ software: "unknown", units: null, liveListings: null, isLocal: false, shop: null }),
    ).toBe("Software unknown, not shopped yet");
    expect(
      whyThisLead({
        ...base,
        software: "none",
        shop: { medianReplyMinutes: null, anyNoReply: true, shopCount: 1 },
      }),
    ).toBe("No portal found, ~180 units, 14 listings, no reply to shop");
  });
});

describe("formatMinutes", () => {
  it("formats minutes, hours and days", async () => {
    const { formatMinutes } = await import("@/lib/domain/scoring");
    expect(formatMinutes(38)).toBe("38m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(252)).toBe("4h 12m");
    expect(formatMinutes(3060)).toBe("2d 3h");
  });
});
