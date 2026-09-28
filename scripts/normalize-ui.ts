import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeUiSource } from "@/lib/design/normalize-ui";

// Runs after `shadcn add` (via `pnpm ui:add`). Why: registry components ship with
// dark: overrides, transition-all and extra shadows that our design contract bans.
const dir = path.join(process.cwd(), "components/ui");
let changed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
  const full = path.join(dir, file);
  const before = readFileSync(full, "utf8");
  const after = normalizeUiSource(before);
  if (after !== before) {
    writeFileSync(full, after);
    changed += 1;
  }
}
console.log(`Normalized ${changed} component file(s) in components/ui.`);
