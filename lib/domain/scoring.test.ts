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

describe("finder signals (spec §6)", () => {
  it("adds +10 when reviews mention slow or no responses", () => {
    const r = scoreLead({ ...base, isLocal: false, reviewFlags: 2 }, DEFAULT_WEIGHTS);
    expect(r.breakdown.find((b) => b.rule === "reviewSignals")).toEqual({
      rule: "reviewSignals",
      points: 10,
      reason: "2 reviews mention slow or no responses",
    });
    expect(
      scoreLead({ ...base, reviewFlags: 0 }, DEFAULT_WEIGHTS).breakdown.some(
        (b) => b.rule === "reviewSignals",
      ),
    ).toBe(false);
  });

  it("takes 30 off a likely chain or not-a-fit, never below 0", () => {
    const r = scoreLead(
      { ...base, fit: { status: "not_a_fit", reason: "Probably not a fit: HOA or condo association only" } },
      DEFAULT_WEIGHTS,
    );
    expect(r.score).toBe(70);
    expect(r.breakdown.at(-1)).toMatchObject({ rule: "chainOrNotFit", points: -30 });
    const low = scoreLead(
      {
        software: "unknown",
        units: null,
        liveListings: null,
        isLocal: false,
        shop: null,
        fit: { status: "excluded", reason: "Chain" },
      },
      DEFAULT_WEIGHTS,
    );
    expect(low.score).toBe(0);
  });

  it("fills in missing new weights from the defaults for older saved settings", () => {
    const old = {
      notAppfolio: 30,
      noSoftware: 20,
      listings3to25: 20,
      slowReply: 25,
      units50to500: 15,
      local: 10,
    };
    const r = scoreLead({ ...base, isLocal: false, reviewFlags: 1 }, old as typeof DEFAULT_WEIGHTS);
    expect(r.breakdown.some((b) => b.rule === "reviewSignals" && b.points === 10)).toBe(true);
  });

  it("mentions review flags and fit problems in the why line", () => {
    expect(whyThisLead({ ...base, reviewFlags: 2 })).toBe(
      "Buildium, ~180 units, 14 listings, first reply 4h 12m, 2 reviews mention no callback",
    );
    expect(whyThisLead({ ...base, reviewFlags: 1 })).toContain("1 review mentions no callback");
    expect(
      whyThisLead({ ...base, fit: { status: "not_a_fit", reason: "Probably not a fit: Single building" } }),
    ).toContain("Probably not a fit: Single building");
  });
});
