import { describe, expect, it } from "vitest";
import { normalizeUiSource } from "@/lib/design/normalize-ui";

describe("normalizeUiSource", () => {
  it("removes dark: variants because tokens already switch themes", () => {
    expect(normalizeUiSource(`"bg-input/30 dark:bg-input/50 dark:hover:bg-input/60 border"`)).toBe(
      `"bg-input/30 border"`,
    );
  });

  it("replaces transition-all with explicit properties", () => {
    expect(normalizeUiSource(`"inline-flex transition-all outline-none"`)).toBe(
      `"inline-flex transition-[color,background-color,border-color,box-shadow,opacity,scale] outline-none"`,
    );
  });

  it("maps shadows onto the three allowed tokens", () => {
    expect(normalizeUiSource(`"shadow-xs hover:shadow-2xl shadow-xl"`)).toBe(
      `"shadow-sm hover:shadow-lg shadow-lg"`,
    );
  });

  it("handles a dark: class at the start of a string", () => {
    expect(normalizeUiSource(`"dark:bg-input/30 border"`)).toBe(`"border"`);
  });

  it("keeps strings that are just spaces", () => {
    expect(normalizeUiSource(`const sep = " ";`)).toBe(`const sep = " ";`);
  });

  it("turns the 1px press nudge into the brief's 0.97 press scale", () => {
    expect(
      normalizeUiSource(`"outline-none active:not-aria-[haspopup]:translate-y-px disabled:opacity-50"`),
    ).toBe(
      `"outline-none active:not-aria-[haspopup]:scale-(--press-scale) duration-(--duration-press) ease-out disabled:opacity-50"`,
    );
  });

  it("replaces translucent foreground text with the contrast-tested muted token", () => {
    expect(normalizeUiSource(`"text-foreground/60 hover:text-foreground/80 text-foreground"`)).toBe(
      `"text-muted-foreground hover:text-foreground text-foreground"`,
    );
  });

  it("gives outline controls a 3:1 boundary instead of the decorative border", () => {
    expect(normalizeUiSource(`outline: "border-border bg-background hover:bg-muted"`)).toBe(
      `outline: "border-input bg-card hover:bg-muted"`,
    );
  });

  it("uses our cn, which knows the type-scale utilities", () => {
    expect(normalizeUiSource(`import { cn } from "cn";`)).toBe(`import { cn } from "@/lib/utils";`);
  });

  it("leaves unrelated code alone", () => {
    const src = `const darkMode = "dark"; // dark: is a word here`;
    expect(normalizeUiSource(`"p-2"`)).toBe(`"p-2"`);
    expect(normalizeUiSource(src)).toBe(src);
  });
});
