// Measures every required pair and runs the dataviz validator on chart + status colors.
import { execFileSync } from "node:child_process";
import { PALETTES, TEXT_PAIRS, UI_PAIRS } from "./palettes.mjs";

const VALIDATOR = process.env.VALIDATOR;
const lum = (h) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

let failures = 0;
const report = {};
for (const [key, p] of Object.entries(PALETTES)) {
  report[key] = {};
  for (const mode of ["light", "dark"]) {
    const t = p[mode];
    const rows = [...TEXT_PAIRS, ...UI_PAIRS].map(([a, b, min]) => {
      const r = ratio(t[a], t[b]);
      if (r < min) {
        failures++;
        console.log(`FAIL ${key}/${mode} ${a} on ${b}: ${r.toFixed(2)} < ${min}`);
      }
      return { a, b, min, r: Number(r.toFixed(2)) };
    });
    const charts = [1, 2, 3, 4, 5].map((i) => t[`chart-${i}`]).join(",");
    const status = ["success", "warning", "destructive", "info"].map((k) => t[k]).join(",");
    const run = (pal) => {
      try {
        return {
          ok: true,
          out: execFileSync("node", [VALIDATOR, pal, "--mode", mode, "--surface", t.surface], {
            encoding: "utf8",
          }),
        };
      } catch (e) {
        return { ok: false, out: e.stdout };
      }
    };
    const c = run(charts),
      s = run(status);
    if (!c.ok) {
      failures++;
      console.log(`FAIL ${key}/${mode} charts\n${c.out}`);
    }
    if (!s.ok)
      console.log(
        `note ${key}/${mode} status (icon+label always present)\n${s.out
          .split("\n")
          .filter((l) => /CVD|Normal|FAIL/.test(l))
          .join("\n")}`,
      );
    report[key][mode] = { rows, chartsOk: c.ok, chartsOut: c.out, statusOk: s.ok, statusOut: s.out };
  }
}
console.log(failures ? `\n${failures} failure(s)` : "\nAll required pairs and chart palettes pass.");
if (process.argv.includes("--json")) process.stdout.write("\n@@JSON@@" + JSON.stringify(report));
