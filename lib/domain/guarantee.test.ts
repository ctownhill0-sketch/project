import { describe, expect, it } from "vitest";
import {
  addDays,
  DEFAULT_GUARANTEE,
  daysElapsed,
  pilotOutcome,
  vacancyGuarantee,
  weightedMedianReply,
  type DayMetric,
} from "@/lib/domain/guarantee";

const day = (tours: number, median: number | null, inquiries = 4): DayMetric => ({
  inquiries,
  medianReplySeconds: median,
  tours,
});

describe("daysElapsed", () => {
  it("counts calendar days since day 0", () => {
    expect(daysElapsed("2026-09-22", "2026-09-29")).toBe(7);
    expect(daysElapsed("2026-09-29", "2026-09-29")).toBe(0);
    expect(daysElapsed("2026-10-30", "2026-11-02")).toBe(3); // across the DST change
  });
});

describe("addDays", () => {
  it("moves a calendar date", () => {
    expect(addDays("2026-09-29", 13)).toBe("2026-10-12");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });
});

describe("weightedMedianReply", () => {
  it("weights each day's median by its inquiries and ignores days without one", () => {
    expect(weightedMedianReply([day(0, 30, 1), day(0, 90, 5), day(0, null, 9)])).toBe(90);
    expect(weightedMedianReply([day(0, 30, 3), day(0, 90, 1)])).toBe(30);
    expect(weightedMedianReply([day(0, null)])).toBeNull();
    expect(weightedMedianReply([])).toBeNull();
  });
});

describe("vacancyGuarantee", () => {
  const onTrackWeek = [day(0, 40), day(0, 35), day(1, 45), day(0, 30), day(1, 40), day(0, 50), day(1, 30)];

  it("is on track before day 7, whatever the numbers", () => {
    const g = vacancyGuarantee([day(0, 200)], 3);
    expect(g.status).toBe("on_track");
    expect(g.reasons).toEqual(["Too early to judge: at risk is checked from day 7."]);
  });

  it("is on track at day 7 when tours project to the target and replies are fast", () => {
    const g = vacancyGuarantee(onTrackWeek, 7);
    expect(g).toMatchObject({ status: "on_track", tours: 3, projectedTours: 6, medianReplySeconds: 40 });
  });

  it("is at risk from day 7 when tours project short or the median reply is slow", () => {
    const fewTours = vacancyGuarantee(
      onTrackWeek.map((d, i) => ({ ...d, tours: i === 5 ? 1 : 0 })),
      7,
    );
    expect(fewTours.status).toBe("at_risk");
    expect(fewTours.reasons).toEqual(["Tours project to 2, under the target of 5."]);
    const slow = vacancyGuarantee(
      onTrackWeek.map((d) => ({ ...d, medianReplySeconds: 80 })),
      7,
    );
    expect(slow.status).toBe("at_risk");
    expect(slow.reasons).toEqual(["Median reply is 80s, over 60s."]);
  });

  it("is met or missed from day 14, on actual tours", () => {
    const fortnight = [...onTrackWeek, ...onTrackWeek];
    expect(vacancyGuarantee(fortnight, 14)).toMatchObject({ status: "met", tours: 6, reasons: [] });
    expect(vacancyGuarantee(onTrackWeek, 15)).toMatchObject({
      status: "missed",
      reasons: ["3 tours, under the target of 5."],
    });
  });

  it("can't be met without reply data", () => {
    const g = vacancyGuarantee(
      Array.from({ length: 14 }, () => day(1, null)),
      14,
    );
    expect(g.status).toBe("missed");
    expect(g.reasons).toEqual(["No reply times entered."]);
  });

  it("projects over the days that have data when today's entry is already in", () => {
    const eightDays = [...onTrackWeek, day(0, 40)];
    expect(vacancyGuarantee(eightDays, 7, DEFAULT_GUARANTEE, 8).projectedTours).toBe(5.3);
    expect(vacancyGuarantee(onTrackWeek, 7, DEFAULT_GUARANTEE, 7).projectedTours).toBe(6);
    expect(vacancyGuarantee([day(2, 40), day(0, 40)], 1, DEFAULT_GUARANTEE, 2).projectedTours).toBe(14);
  });

  it("uses the configured rules", () => {
    const g = vacancyGuarantee(onTrackWeek, 7, { ...DEFAULT_GUARANTEE, tourTarget: 8 });
    expect(g.status).toBe("at_risk");
  });
});

describe("pilotOutcome", () => {
  it("is met only when every vacancy met the guarantee", () => {
    expect(pilotOutcome(["met", "met"])).toBe("met");
    expect(pilotOutcome(["met", "missed"])).toBe("missed");
    expect(pilotOutcome([])).toBe("missed");
  });
});
