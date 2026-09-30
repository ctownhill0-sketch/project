import { describe, expect, it } from "vitest";
import { checkText, validatePattern, type Rule } from "@/lib/domain/fair-housing";
import { FAIR_HOUSING_RULES } from "@/lib/seed/rules";

const RULES: Rule[] = FAIR_HOUSING_RULES.map((r, i) => ({ id: `r${i}`, ...r }));
const outcome = (text: string) => checkText(text, RULES).outcome;

describe("checkText", () => {
  it("passes ordinary listing and pitch language", () => {
    for (const text of [
      "Sunny two-bedroom with a family room and in-unit laundry.",
      "Walk to St. Mary's church, the park and the 2 train.",
      "Section 8 and all vouchers welcome.",
      "No pets; assistance animals are welcome.",
      "Kids' playroom on the ground floor.",
      "Our median reply took 9 hours after hours. Renters pick whoever answers first.",
      "No smoking. No subletting.",
      "",
    ]) {
      expect(outcome(text), text).toBe("pass");
    }
  });

  it("blocks protected-class exclusions, case-insensitively", () => {
    expect(outcome("Great unit. NO KIDS.")).toBe("block");
    expect(outcome("Adults-only building")).toBe("block");
    expect(outcome("No Section 8")).toBe("block");
    expect(outcome("English only please")).toBe("block");
  });

  it("covers NY/NJ source-of-income patterns", () => {
    for (const text of [
      "No vouchers.",
      "Section 8 not accepted",
      "No CityFHEPS or HRA.",
      "No FHEPS",
      "not accepting programs",
      "Voucher holders need not apply",
      "No government assistance",
      "No welfare",
      "No SRAP",
    ]) {
      expect(outcome(text), text).toBe("block");
    }
    expect(outcome("Income must be from employment")).toBe("warn");
    expect(outcome("Must show a paycheck")).toBe("warn");
  });

  it("warns on preference language and reports each match once with its rule", () => {
    const r = checkText("Ideal for young professionals. No pets. Young professionals love it.", RULES);
    expect(r.outcome).toBe("warn");
    expect(r.matches.map((m) => m.category).sort()).toEqual(["age", "disability"]);
    expect(r.matches[0]).toMatchObject({ severity: "warn", phrase: expect.stringMatching(/professionals/i) });
  });

  it("block wins over warn", () => {
    expect(outcome("Perfect for couples, no kids")).toBe("block");
  });

  it("skips a broken rule instead of throwing", () => {
    const r = checkText("no kids", [
      { id: "bad", pattern: "(", category: "x", severity: "block", explanation: "" },
    ]);
    expect(r.outcome).toBe("pass");
  });
});

describe("validatePattern", () => {
  it("accepts a sane regex and rejects broken, empty, overlong or catastrophic ones", () => {
    expect(validatePattern(String.raw`\bno kids\b`)).toBeNull();
    expect(validatePattern("(")).toMatch(/isn't a valid pattern/);
    expect(validatePattern("  ")).toMatch(/Enter/);
    expect(validatePattern("a".repeat(301))).toMatch(/300/);
    expect(validatePattern("(a+)+$")).toMatch(/nested/);
    expect(validatePattern(".")).toMatch(/everything/);
  });
});
