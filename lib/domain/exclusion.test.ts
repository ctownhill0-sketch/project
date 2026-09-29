import { describe, expect, it } from "vitest";
import { classifyFit, DEFAULT_EXCLUSION_RULES, type ExclusionRuleInput } from "@/lib/domain/exclusion";

const rules: (ExclusionRuleInput & { id: string })[] = DEFAULT_EXCLUSION_RULES.map((r, i) => ({
  ...r,
  id: `r${i}`,
}));
const place = (name: string, extra: { domain?: string | null; types?: string[] } = {}) => ({
  name,
  domain: extra.domain ?? null,
  types: extra.types ?? [],
});

describe("classifyFit", () => {
  it("excludes national chains by name and by domain", () => {
    expect(classifyFit(place("Greystar Real Estate Partners"), rules)).toMatchObject({ status: "excluded" });
    expect(classifyFit(place("Invitation Homes"), rules).reason).toMatch(/Invitation Homes/);
    expect(classifyFit(place("Local office", { domain: "greystar.com" }), rules)).toMatchObject({
      status: "excluded",
    });
  });

  it("does not match look-alike names", () => {
    expect(classifyFit(place("Greystone Realty Management"), rules).status).toBe("ok");
    expect(classifyFit(place("Condo Rentals & Property Management"), rules).status).toBe("ok");
    expect(classifyFit(place("Harborline Property Management"), rules).status).toBe("ok");
  });

  it("marks HOA-only, commercial-only, vacation, sales-only and single buildings as not a fit", () => {
    expect(classifyFit(place("Maple Court Homeowners Association"), rules)).toMatchObject({
      status: "not_a_fit",
      category: "hoa",
    });
    expect(classifyFit(place("Ironbridge Commercial Real Estate"), rules)).toMatchObject({
      category: "commercial",
    });
    expect(classifyFit(place("Shoreline Vacation Rentals"), rules)).toMatchObject({ category: "vacation" });
    expect(classifyFit(place("Anything", { types: ["lodging"] }), rules)).toMatchObject({
      category: "vacation",
    });
    expect(classifyFit(place("The Larkspur Apartments"), rules)).toMatchObject({
      category: "single_building",
    });
    expect(classifyFit(place("Keller Williams Hoboken"), rules)).toMatchObject({ category: "sales_only" });
  });

  it("chains beat not-a-fit, and inactive rules are ignored", () => {
    const inactive = rules.map((r) => ({ ...r, isActive: false }));
    expect(classifyFit(place("Greystar Vacation Rentals"), rules).status).toBe("excluded");
    expect(classifyFit(place("Greystar Real Estate Partners"), inactive).status).toBe("ok");
  });

  it("supports /regex/ patterns and ignores broken ones", () => {
    const custom = [
      {
        id: "x",
        kind: "not_a_fit" as const,
        category: "other",
        match: "name" as const,
        pattern: "/^test.*llc$/",
        isActive: true,
      },
    ];
    expect(classifyFit(place("Test Holdings LLC"), custom).status).toBe("not_a_fit");
    const broken = [{ ...custom[0]!, pattern: "/([/" }];
    expect(classifyFit(place("Test Holdings LLC"), broken).status).toBe("ok");
  });
});
