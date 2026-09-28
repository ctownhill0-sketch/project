import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_HOURS, hoursBucket, isUsFederalHoliday } from "@/lib/domain/hours";

const at = (iso: string) => hoursBucket(new Date(iso), DEFAULT_BUSINESS_HOURS);

describe("hoursBucket (America/New_York)", () => {
  it("classifies weekday business hours with an exclusive end", () => {
    expect(at("2026-10-28T13:00:00Z")).toBe("business"); // Wed 09:00 EDT
    expect(at("2026-10-28T20:59:00Z")).toBe("business"); // Wed 16:59 EDT
    expect(at("2026-10-28T21:00:00Z")).toBe("after_hours"); // Wed 17:00 EDT
    expect(at("2026-10-28T12:59:00Z")).toBe("after_hours"); // Wed 08:59 EDT
  });

  it("stays correct across the end of daylight saving (1 Nov 2026)", () => {
    // Same UTC clock time, different local hour once clocks fall back.
    expect(at("2026-10-30T13:30:00Z")).toBe("business"); // Fri 09:30 EDT
    expect(at("2026-11-02T13:30:00Z")).toBe("after_hours"); // Mon 08:30 EST
    expect(at("2026-11-02T14:30:00Z")).toBe("business"); // Mon 09:30 EST
  });

  it("stays correct across the start of daylight saving (8 Mar 2026)", () => {
    expect(at("2026-03-06T14:30:00Z")).toBe("business"); // Fri 09:30 EST
    expect(at("2026-03-09T13:30:00Z")).toBe("business"); // Mon 09:30 EDT
  });

  it("puts all of Saturday in its own bucket and Sunday in after-hours", () => {
    expect(at("2026-10-31T15:00:00Z")).toBe("saturday"); // Sat 11:00
    expect(at("2026-11-01T02:00:00Z")).toBe("saturday"); // Sat 22:00 EDT
    expect(at("2026-11-01T15:00:00Z")).toBe("after_hours"); // Sun 10:00 EST
  });

  it("treats US federal holidays as after-hours", () => {
    expect(at("2026-11-26T15:00:00Z")).toBe("after_hours"); // Thanksgiving, Thu 10:00
    expect(at("2026-12-25T15:00:00Z")).toBe("after_hours"); // Christmas, Fri
  });
});

describe("isUsFederalHoliday", () => {
  it("knows fixed, floating and observed dates", () => {
    expect(isUsFederalHoliday("2026-01-19")).toBe(true); // MLK: 3rd Monday
    expect(isUsFederalHoliday("2026-05-25")).toBe(true); // Memorial: last Monday
    expect(isUsFederalHoliday("2026-07-03")).toBe(true); // July 4 falls on Sat → observed Fri
    expect(isUsFederalHoliday("2026-10-12")).toBe(true); // Columbus: 2nd Monday
    expect(isUsFederalHoliday("2027-12-24")).toBe(true); // Dec 25 2027 is Sat → Fri
    expect(isUsFederalHoliday("2026-10-13")).toBe(false);
  });
});

describe("hoursBucket with edited settings", () => {
  it("can fold Saturday into after-hours and keep holidays as business days", () => {
    const hours = { ...DEFAULT_BUSINESS_HOURS, saturdayBucket: false, holidaysAreAfterHours: false };
    expect(hoursBucket(new Date("2026-10-31T15:00:00Z"), hours)).toBe("after_hours"); // Sat
    expect(hoursBucket(new Date("2026-11-26T15:00:00Z"), hours)).toBe("business"); // Thanksgiving
  });

  it("respects custom start and end times", () => {
    const hours = { ...DEFAULT_BUSINESS_HOURS, start: "08:30", end: "17:30" };
    expect(hoursBucket(new Date("2026-10-28T12:45:00Z"), hours)).toBe("business"); // Wed 08:45 EDT
    expect(hoursBucket(new Date("2026-10-28T21:15:00Z"), hours)).toBe("business"); // Wed 17:15 EDT
  });
});
