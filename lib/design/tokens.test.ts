import { describe, expect, it } from "vitest";
import { durations, easings, radii, shadows, typeScale } from "@/lib/design/tokens";

describe("shadow tokens", () => {
  it("has exactly the three brief shadows", () => {
    expect(Object.keys(shadows)).toEqual(["sm", "md", "lg"]);
    expect(shadows.sm).toBe(
      "0px 2px 3px -1px rgba(0,0,0,0.1), 0px 1px 0px 0px rgba(25,28,33,0.02), 0px 0px 0px 1px rgba(25,28,33,0.08)",
    );
    expect(shadows.lg.startsWith("0 2.8px 2.2px rgba(0,0,0,0.034)")).toBe(true);
  });
});

describe("motion tokens", () => {
  it("keeps every duration inside the brief's ranges", () => {
    expect(durations.press).toBeGreaterThanOrEqual(100);
    expect(durations.press).toBeLessThanOrEqual(160);
    expect(durations.tooltip).toBeGreaterThanOrEqual(125);
    expect(durations.tooltip).toBeLessThanOrEqual(200);
    expect(durations.dropdown).toBeGreaterThanOrEqual(150);
    expect(durations.dropdown).toBeLessThanOrEqual(250);
    expect(durations.dialog).toBeGreaterThanOrEqual(200);
    expect(durations.dialog).toBeLessThanOrEqual(300);
    expect(durations.color).toBeLessThanOrEqual(100);
  });

  it("never uses an ease-in curve", () => {
    for (const curve of Object.values(easings)) expect(curve).not.toMatch(/^ease-in$|^ease$/);
    expect(easings.out).toBe("cubic-bezier(0.23,1,0.32,1)");
    expect(easings.inOut).toBe("cubic-bezier(0.77,0,0.175,1)");
    expect(easings.drawer).toBe("cubic-bezier(0.32,0.72,0,1)");
  });
});

describe("shape and type tokens", () => {
  it("uses 8/12/16 radii and the brief's type scale", () => {
    expect(radii).toEqual({ control: 8, card: 12, modal: 16 });
    expect(typeScale.map((s) => `${s.size}/${s.line}`)).toEqual([
      "48/56",
      "36/44",
      "28/36",
      "22/30",
      "16/24",
      "14/20",
      "12/16",
    ]);
  });
});
