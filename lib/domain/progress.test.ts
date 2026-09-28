import { describe, expect, it } from "vitest";
import { killTestProgress, projection, weekOverWeek } from "@/lib/domain/progress";

describe("killTestProgress", () => {
  const settings = {
    day0: "2026-09-29",
    deadline: "2026-12-28",
    pilotsTarget: 3,
    conversationsTarget: 60,
    afterHoursMedianMinutes: 10,
  };

  it("counts down to the start before Day 0", () => {
    const p = killTestProgress(settings, new Date("2026-09-28T16:00:00Z"), {
      pilots: 0,
      conversations: 0,
      afterHoursMedianMinutes: 252,
    });
    expect(p).toMatchObject({ started: false, startsInDays: 1, day: 0, daysLeft: 91 });
  });

  it("reports the day number and what is met", () => {
    const p = killTestProgress(settings, new Date("2026-10-08T16:00:00Z"), {
      pilots: 3,
      conversations: 12,
      afterHoursMedianMinutes: 252,
    });
    expect(p).toMatchObject({
      started: true,
      day: 9,
      daysLeft: 81,
      pilotsMet: true,
      conversationsMet: false,
      afterHoursMet: true,
    });
  });

  it("treats a missing after-hours median as unknown, not met", () => {
    const p = killTestProgress(settings, new Date("2026-10-08T16:00:00Z"), {
      pilots: 0,
      conversations: 0,
      afterHoursMedianMinutes: null,
    });
    expect(p.afterHoursMet).toBeNull();
  });
});

describe("weekOverWeek", () => {
  it("compares the last two weeks", () => {
    expect(weekOverWeek([300, 400, 428])).toBeCloseTo(0.07);
    expect(weekOverWeek([400, 400])).toBe(0);
  });
  it("is unknown without two weeks or from zero", () => {
    expect(weekOverWeek([400])).toBeNull();
    expect(weekOverWeek([0, 400])).toBeNull();
  });
});

describe("projection", () => {
  it("compounds 7% a week from the latest MRR", () => {
    expect(projection(400, 3, 0.07).map((v) => Math.round(v))).toEqual([400, 428, 458, 490]);
  });
});
