import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Design-contract bans that a linter can't express, checked across our own UI code. */
const RULES: [RegExp, string, string?][] = [
  [/\bspace-[xy]-/, "use gap-* instead of space-x/space-y"],
  [/\btransition-all\b|transition:\s*all/, "never transition all properties"],
  [/\bshadow-(xs|xl|2xl|inner)\b/, "only shadow-sm, shadow-md and shadow-lg exist"],
  [/\b(bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/, "use semantic color tokens, not raw hex"],
  [/\bdark:/, "no manual dark: overrides; tokens already switch"],
  [/\bz-\[?\d/, "no hand-set z-index", "not-in-ui"],
  [/\bease-in\b(?!-out)/, "never ease-in"],
  [/\buppercase\b/, "sentence case; no all-caps labels"],
  [/\bfont-(serif|mono)\b/, "Inter only; no serif display or monospace labels"],
  [/\bbg-gradient-|\bbg-linear-|linear-gradient\(/, "no gradient washes"],
];

const ROOTS = ["app", "components"];
const SKIP = new Set(["node_modules", ".next"]);

function files(dir: string): string[] {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(files(full));
    else if (/\.(tsx?|css)$/.test(entry) && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

describe("design class rules", () => {
  it("our UI code follows the design contract", () => {
    const violations: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes("design-rules-ignore")) return;
          for (const [pattern, why, scope] of RULES) {
            // shadcn's own overlays manage their stacking; we never add z-index ourselves.
            if (scope === "not-in-ui" && file.includes(path.join("components", "ui"))) continue;
            if (pattern.test(line)) violations.push(`${file}:${i + 1} ${why}`);
          }
        });
    }
    expect(violations).toEqual([]);
  });
});
