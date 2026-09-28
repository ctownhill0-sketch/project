import { describe, expect, it } from "vitest";
import { createRng, fictionalDomain, fictionalFirmName, fictionalPhone } from "@/lib/seed/fictional";

describe("fictional data", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(fictionalFirmName(a)).toBe(fictionalFirmName(b));
  });

  it("only produces reserved .example domains and 555-01xx phone numbers", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i += 1) {
      const name = fictionalFirmName(rng);
      expect(fictionalDomain(name)).toMatch(/^[a-z0-9-]+\.example$/);
      expect(fictionalPhone(rng)).toMatch(/^\+1\d{3}55501\d{2}$/);
    }
  });

  it("can produce 500 distinct firm names", () => {
    const rng = createRng(1);
    const names = new Set<string>();
    for (let i = 0; i < 5000 && names.size < 500; i += 1) names.add(fictionalFirmName(rng));
    expect(names.size).toBe(500);
  });
});
