import { describe, expect, it } from "vitest";
import { expectedMrr, monthlyPrice } from "@/lib/domain/pipeline";

describe("pricing", () => {
  it("charges the greater of the $400 minimum and $119 per vacancy", () => {
    expect(monthlyPrice(2)).toBe(400);
    expect(monthlyPrice(3)).toBe(400);
    expect(monthlyPrice(4)).toBe(476);
  });

  it("weights expected MRR by probability (0–100)", () => {
    expect(expectedMrr({ vacancies: 2, probability: 50 })).toBe(200);
    expect(expectedMrr({ vacancies: 5, probability: 75 })).toBe(446.25);
    expect(expectedMrr({ vacancies: 5, probability: 0 })).toBe(0);
  });

  it("rejects impossible inputs", () => {
    expect(() => expectedMrr({ vacancies: 0, probability: 50 })).toThrow(/vacancies/);
    expect(() => expectedMrr({ vacancies: 2, probability: 101 })).toThrow(/probability/);
  });
});
