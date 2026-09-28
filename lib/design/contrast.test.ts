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
  // Status TEXT only sits on a surface: StatusBadge always carries its own card fill.
  ["success", "card"],
  ["warning", "card"],
  ["destructive", "card"],
  ["info", "card"],
  ["success", "popover"],
  ["warning", "popover"],
  ["destructive", "popover"],
  ["info", "popover"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["accent-foreground", "accent"],
  // Inline error text (field errors, invalid labels, alerts) may sit on any background.
  ["destructive-text", "background"],
  ["destructive-text", "card"],
  ["destructive-text", "muted"],
] as const;

/** Control boundaries and focus indicators (WCAG 1.4.11 / 2.4.11). */
const UI_PAIRS = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
  ["ring", "card"],
  ["primary", "card"],
  ["accent", "card"],
  // Status icons and marks may touch the page background.
  ["success", "background"],
  ["warning", "background"],
  ["destructive", "background"],
  ["info", "background"],
  // Chart colors are drawn as 2px lines on the card surface.
  ["chart-1", "card"],
  ["chart-2", "card"],
  ["chart-3", "card"],
  ["chart-4", "card"],
  ["chart-5", "card"],
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

describe("destructive text on its own 10% tint", () => {
  it.each(["light", "dark"] as const)("%s", (mode) => {
    const t = themes[mode];
    const mix = (fg: string, bg: string, a: number) =>
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    expect(contrastRatio(t["destructive-text"], mix(t.destructive, t.card, 0.1))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("accent rule", () => {
  it("accent is a fill with its own readable foreground", () => {
    for (const t of Object.values(themes))
      expect(contrastRatio(t["accent-foreground"], t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
