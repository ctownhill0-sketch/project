import {
  validate,
  contrast,
} from "/tmp/claude-0/bundled-skills/2.1.284/4d0571db6ce488f91b615eacb91404e8/dataviz/scripts/validate_palette.js";
// OKLCH -> sRGB hex (clipped); null if out of gamut.
function oklchToHex(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180),
    b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b,
    m_ = L - 0.1055613458 * a - 0.0638541728 * b,
    s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (lin.some((v) => v < -0.001 || v > 1.001)) return null;
  const g = lin.map((v) => {
    v = Math.min(1, Math.max(0, v));
    const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(e * 255)
      .toString(16)
      .padStart(2, "0");
  });
  return "#" + g.join("").toUpperCase();
}
const [mode, surface] = process.argv.slice(2);
const HUES = { success: [140, 150], warning: [65, 75], destructive: [22, 30], info: [250, 262] };
const Ls = mode === "light" ? [0.44, 0.47, 0.5, 0.53, 0.56, 0.59] : [0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86];
const Cs = [0.1, 0.13, 0.16, 0.19];
const pools = {};
for (const [k, hs] of Object.entries(HUES)) {
  pools[k] = [];
  for (const H of hs)
    for (const L of Ls)
      for (const C of Cs) {
        const hex = oklchToHex(L, C, H);
        if (hex && contrast(hex, surface) >= 4.5) pools[k].push(hex);
      }
}
console.log(Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])));
let best = null;
const keep = [];
import("/tmp/claude-0/bundled-skills/2.1.284/4d0571db6ce488f91b615eacb91404e8/dataviz/scripts/validate_palette.js");
const cvdOf = (rep) => {
  const row = rep.report.find((r) => r[0] === "CVD separation");
  const m = /ΔE ([\d.]+)/.exec(row?.[2] ?? "");
  return m ? Number(m[1]) : 0;
};
for (const s of pools.success)
  for (const w of pools.warning)
    for (const d of pools.destructive)
      for (const i of pools.info) {
        const rep = validate([s, w, d, i], { mode, surface, pairs: "all" });
        const norm = Number(
          /ΔE ([\d.]+)/.exec(rep.report.find((r) => r[0] === "Normal-vision floor")?.[2] ?? "")?.[1] ?? 0,
        );
        const score = norm >= 15 ? cvdOf(rep) : 0;
        const entry = {
          set: [s, w, d, i],
          score,
          ok: rep.ok,
          rep: rep.report.map((r) => `${r[0]}: ${r[2]}`).join("\n  "),
        };
        if (!best || score > best.score) best = entry;
        if (score >= (mode === "light" ? 7.5 : 8)) keep.push(entry);
      }
console.log(mode, "max-separation:", best.set.join(","), "worst", best.score);
// Most restrained: the smallest total distance from a calm target lightness.
const Lof = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459141 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2;
};
const target = mode === "light" ? 0.52 : 0.72;
keep.sort(
  (a, b) =>
    a.set.reduce((t, c) => t + Math.abs(Lof(c) - target), 0) -
    b.set.reduce((t, c) => t + Math.abs(Lof(c) - target), 0),
);
console.log(`${keep.length} sets clear the bar. Most restrained:`);
for (const k of keep.slice(0, 3))
  console.log(
    " ",
    k.set.join(","),
    "worst",
    k.score,
    "\n   ",
    k.rep
      .split("\n")
      .filter((l) => /CVD|Normal/.test(l))
      .join(" | "),
  );
