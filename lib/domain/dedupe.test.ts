import { describe, expect, it } from "vitest";
import {
  findDuplicate,
  jaroWinkler,
  normalizeDomain,
  normalizeFirmName,
  normalizePhone,
  type DedupeCandidate,
  type ExistingFirm,
} from "@/lib/domain/dedupe";

describe("normalizers", () => {
  it("normalizes domains from URLs and bare hosts", () => {
    expect(normalizeDomain("https://www.Harborline-Residential.example/rentals?x=1")).toBe(
      "harborline-residential.example",
    );
    expect(normalizeDomain("harborline.example")).toBe("harborline.example");
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("not a url")).toBeNull();
  });

  it("normalizes US phones to 10 digits", () => {
    expect(normalizePhone("(201) 555-0142")).toBe("2015550142");
    expect(normalizePhone("+1 201-555-0142")).toBe("2015550142");
    expect(normalizePhone("555-0142")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("strips legal suffixes and generic words from firm names", () => {
    expect(normalizeFirmName("Harborline Property Management, LLC")).toBe("harborline");
    expect(normalizeFirmName("The Harborline Group Inc.")).toBe("harborline");
    expect(normalizeFirmName("Harborline Realty & Management Co")).toBe("harborline");
  });
});

describe("jaroWinkler", () => {
  it("is 1 for equal strings and lower for different ones", () => {
    expect(jaroWinkler("harborline", "harborline")).toBe(1);
    expect(jaroWinkler("harborline", "harbourline")).toBeGreaterThan(0.9);
    expect(jaroWinkler("harborline", "quarry oak")).toBeLessThan(0.6);
    expect(jaroWinkler("", "x")).toBe(0);
  });
});

const existing: ExistingFirm[] = [
  {
    id: "c1",
    placeId: "place-1",
    normalizedDomain: "harborline.example",
    normalizedPhone: "2015550142",
    normalizedName: "harborline",
    city: "Hoboken",
    dnc: false,
  },
  {
    id: "c2",
    placeId: null,
    normalizedDomain: "quarryoak.example",
    normalizedPhone: "2015550177",
    normalizedName: "quarry oak",
    city: "Newark",
    dnc: true,
    dncSince: new Date("2026-09-01T12:00:00Z"),
  },
];

const base: DedupeCandidate = {
  placeId: "place-new",
  normalizedDomain: null,
  normalizedPhone: null,
  normalizedName: "brand new",
  city: "Hoboken",
};

describe("findDuplicate", () => {
  it("matches by place ID first", () => {
    expect(findDuplicate({ ...base, placeId: "place-1" }, existing, [])).toMatchObject({
      status: "duplicate",
      companyId: "c1",
      method: "place_id",
    });
  });

  it("matches by normalized domain, then phone", () => {
    expect(findDuplicate({ ...base, normalizedDomain: "harborline.example" }, existing, [])).toMatchObject({
      status: "duplicate",
      method: "domain",
    });
    expect(findDuplicate({ ...base, normalizedPhone: "2015550142" }, existing, [])).toMatchObject({
      status: "duplicate",
      method: "phone",
    });
  });

  it("flags a fuzzy name in the same town as a possible duplicate only", () => {
    expect(findDuplicate({ ...base, normalizedName: "harbourline" }, existing, [])).toMatchObject({
      status: "possible_duplicate",
      companyId: "c1",
      method: "name_town",
    });
    // Same name, different town: not a match.
    expect(
      findDuplicate({ ...base, normalizedName: "harbourline", city: "Newark" }, existing, []),
    ).toMatchObject({
      status: "new",
    });
  });

  it("marks any match to a do-not-call firm as dnc, with the reason", () => {
    const hit = findDuplicate({ ...base, normalizedPhone: "2015550177" }, existing, []);
    expect(hit).toMatchObject({ status: "dnc", companyId: "c2", method: "phone" });
    expect(hit.reason).toMatch(/Do not call/);
  });

  it("honors the do-not-call list for firms that were never leads", () => {
    const hit = findDuplicate({ ...base, normalizedDomain: "blocked.example" }, existing, [
      { kind: "domain", value: "blocked.example", reason: "Asked us not to call", createdAt: new Date() },
    ]);
    expect(hit).toMatchObject({ status: "dnc", companyId: null });
    expect(hit.reason).toMatch(/Asked us not to call/);
  });

  it("returns new when nothing matches", () => {
    expect(findDuplicate(base, existing, [])).toEqual({
      status: "new",
      companyId: null,
      method: null,
      reason: null,
    });
  });
});
