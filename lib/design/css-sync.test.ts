import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { themes, type ThemeName } from "@/lib/design/tokens";

const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

/** Reads `--name: value;` pairs from the first rule whose selector matches exactly. */
function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]));
}

const BLOCKS: [string, ThemeName][] = [
  [":root", "light"],
  [':root[data-theme="dark"]', "dark"],
  // System dark mode when the viewer hasn't picked a theme.
  ['  :root:not([data-theme="light"])', "dark"],
];

describe("globals.css mirrors lib/design/tokens.ts", () => {
  it.each(BLOCKS)("%s matches the %s tokens", (selector, theme) => {
    const block = readBlock(selector);
    for (const [token, value] of Object.entries(themes[theme])) {
      expect.soft(block[token]?.toUpperCase(), `--${token}`).toBe(value.toUpperCase());
    }
  });
});
