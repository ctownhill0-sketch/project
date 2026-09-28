import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";
import { themes, type ThemeName } from "@/lib/design/tokens";

describe("contrastRatio", () => {
  it("matches the WCAG formula", () => {
    expect(contrastRatio("#0F2A44", "#F7F5F0")).toBeCloseTo(13.43, 1);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });
});

const TEXT_MIN = 4.5;
const UI_MIN = 3;

/** [foreground token, background token] pairs that carry text. */
const TEXT_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["foreground", "muted"],
  ["link", "background"],
  ["link", "card"],
  ["link", "muted"],
  ["success", "background"],
  ["success", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["accent-foreground", "accent"],
] as const;

/** Control boundaries and focus indicators (WCAG 1.4.11 / 2.4.11). */
const UI_PAIRS = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
  ["ring", "card"],
  ["chart-1", "card"],
  ["chart-2", "card"],
] as const;

describe.each(Object.keys(themes) as ThemeName[])("%s theme", (name) => {
  const t = themes[name];

  it.each(TEXT_PAIRS)("text %s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(UI_PAIRS)("UI %s on %s ≥ 3:1", (fg, bg) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(UI_MIN);
  });
});

describe("gold rule", () => {
  it("never uses gold as a text color in the light theme", () => {
    const gold = themes.light.accent.toUpperCase();
    const textTokens = [
      "foreground",
      "card-foreground",
      "muted-foreground",
      "link",
      "success",
      "warning",
      "destructive",
    ] as const;
    for (const token of textTokens) expect(themes.light[token].toUpperCase()).not.toBe(gold);
  });
});
