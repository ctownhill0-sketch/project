import { describe, expect, it } from "vitest";
import { DEFAULT_ROI_INPUTS, parseRoiQuery, roi, roiQuery, roiFieldError } from "@/lib/domain/roi";

describe("roi", () => {
  it("costs a vacant day at rent × 12 ÷ 365 ($1,800 → $59.18)", () => {
    expect(roi({ ...DEFAULT_ROI_INPUTS, rent: 1800 }).dailyCost).toBe(59.18);
  });

  it("computes annual loss, savings, cost, net and payback", () => {
    const r = roi({ rent: 1800, turnoversPerYear: 20, daysVacant: 30, daysFaster: 7, vacanciesAtOnce: 2 });
    expect(r).toMatchObject({
      dailyCost: 59.18,
      annualVacancyLoss: 35506.85, // 59.178… × 30 × 20
      annualSavings: 8284.93, // 59.178… × 7 × 20
      monthlyPrice: 400,
      annualCost: 5100, // 400 × 12 + 300 setup
      netSavings: 3184.93,
    });
    expect(r.paybackMonths).toBeCloseTo(7.39, 2);
  });

  it("returns null payback when there are no savings, and never divides by zero", () => {
    expect(
      roi({ rent: 1800, turnoversPerYear: 0, daysVacant: 30, daysFaster: 7, vacanciesAtOnce: 2 })
        .paybackMonths,
    ).toBeNull();
  });

  it("prices by vacancies at once: max($400, n × $119)", () => {
    expect(roi({ ...DEFAULT_ROI_INPUTS, vacanciesAtOnce: 5 }).monthlyPrice).toBe(595);
  });
});

describe("query string (local shareable link)", () => {
  it("round-trips inputs and rejects nonsense", () => {
    const inputs = { rent: 2100, turnoversPerYear: 12, daysVacant: 21, daysFaster: 5, vacanciesAtOnce: 3 };
    expect(parseRoiQuery(new URLSearchParams(roiQuery(inputs)))).toEqual(inputs);
    expect(parseRoiQuery(new URLSearchParams("rent=-5&daysVacant=abc"))).toEqual(DEFAULT_ROI_INPUTS);
    expect(parseRoiQuery(new URLSearchParams("rent=999999999"))).toMatchObject({
      rent: DEFAULT_ROI_INPUTS.rent,
    });
  });
});

describe("roiFieldError", () => {
  it("names the allowed range for an out-of-range value, and is null when it's fine", () => {
    expect(roiFieldError("rent", 1800)).toBeNull();
    expect(roiFieldError("rent", 60000)).toBe("Use a value from 100 to 50,000.");
    expect(roiFieldError("daysVacant", 400)).toBe("Use a value from 0 to 365.");
    expect(roiFieldError("vacanciesAtOnce", 0)).toBe("Use a value from 1 to 500.");
  });
});
