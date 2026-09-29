// Key safety (finder spec §9): build with a canary GOOGLE_PLACES_API_KEY and fail if the canary
// shows up anywhere in the build output: client bundles, RSC payloads, prerendered HTML or server chunks.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const canary = `CANARY-${randomBytes(12).toString("hex")}`;
console.log("Building with a canary Places key…");
execSync("pnpm exec next build", {
  stdio: "inherit",
  env: {
    ...process.env,
    GOOGLE_PLACES_API_KEY: canary,
    PGLITE_DIR: ".data/scan/pglite",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

const hits = [];
let scanned = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "cache") continue;
    const s = statSync(full);
    if (s.isDirectory()) walk(full);
    else if (s.size < 20 * 1024 * 1024) {
      scanned += 1;
      if (readFileSync(full).includes(canary)) hits.push(full);
    }
  }
}
// Self-test: a planted copy of the canary must be found, or the scan proves nothing.
const planted = path.join(".next", "static", "__scan-selftest.txt");
writeFileSync(planted, `leak ${canary}`);
walk(".next");
rmSync(planted);
if (!hits.includes(planted)) {
  console.error("Scanner self-test failed: it did not find the planted canary.");
  process.exit(1);
}
hits.splice(hits.indexOf(planted), 1);
scanned -= 1;
if (hits.length) {
  console.error(`The Places key leaked into ${hits.length} build file(s):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Key safety scan passed: the canary key is in none of ${scanned} build files.`);
