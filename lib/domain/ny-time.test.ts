import { describe, expect, it } from "vitest";
import { nyDayStart, nyMonthStart, nyDateKey } from "@/lib/domain/ny-time";

describe("New York day and month boundaries", () => {
  it("starts the day at NY midnight in daylight time (UTC-4)", () => {
    expect(nyDayStart(new Date("2026-09-29T03:59:00Z")).toISOString()).toBe("2026-09-28T04:00:00.000Z");
    expect(nyDayStart(new Date("2026-09-29T04:00:00Z")).toISOString()).toBe("2026-09-29T04:00:00.000Z");
  });

  it("starts the day at NY midnight in standard time (UTC-5)", () => {
    expect(nyDayStart(new Date("2026-12-01T12:00:00Z")).toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("handles the DST change days", () => {
    expect(nyDayStart(new Date("2026-11-01T15:00:00Z")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(nyDayStart(new Date("2026-03-08T15:00:00Z")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("starts the month on the 1st in NY", () => {
    expect(nyMonthStart(new Date("2026-10-01T02:00:00Z")).toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(nyMonthStart(new Date("2026-10-01T05:00:00Z")).toISOString()).toBe("2026-10-01T04:00:00.000Z");
  });

  it("gives a YYYY-MM-DD key in NY", () => {
    expect(nyDateKey(new Date("2026-09-29T03:00:00Z"))).toBe("2026-09-28");
  });
});
