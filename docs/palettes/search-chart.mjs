import {
  validate,
  contrast,
} from "/tmp/claude-0/bundled-skills/2.1.284/4d0571db6ce488f91b615eacb91404e8/dataviz/scripts/validate_palette.js";
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
  return (
    "#" +
    lin
      .map((v) => {
        v = Math.min(1, Math.max(0, v));
        const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(e * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase()
  );
}
const [name, mode, surface, huesArg] = process.argv.slice(2);
const hues = huesArg.split(",").map(Number);
const Ls = mode === "light" ? [0.46, 0.5, 0.54, 0.58, 0.62, 0.66] : [0.52, 0.56, 0.6, 0.64, 0.66];
const Cs = [0.11, 0.14, 0.17, 0.2];
const pools = hues.map((H) => {
  const out = [];
  for (const dh of [-6, 0, 6])
    for (const L of Ls)
      for (const C of Cs) {
        const x = oklchToHex(L, C, H + dh);
        if (x && contrast(x, surface) >= 3) out.push(x);
      }
  return out;
});
if (pools.some((p) => !p.length)) {
  console.log(
    name,
    mode,
    "empty pool",
    pools.map((p) => p.length),
  );
  process.exit(1);
}
let rng = 7;
const rand = (n) => {
  rng = (rng * 1103515245 + 12345) % 2147483648;
  return rng % n;
};
let best = null;
for (let t = 0; t < 40000; t += 1) {
  const set = pools.map((p) => p[rand(p.length)]);
  const rep = validate(set, { mode, surface });
  if (!rep.ok) continue;
  const cvd = Number(/ΔE ([\d.]+)/.exec(rep.report.find((r) => r[0] === "CVD separation")[2])[1]);
  const nv = Number(/ΔE ([\d.]+)/.exec(rep.report.find((r) => r[0] === "Normal-vision floor")[2])[1]);
  const score = Math.min(cvd, nv / 2);
  if (!best || score > best.score) best = { set, score, cvd, nv };
}
console.log(
  name.padEnd(9),
  mode.padEnd(5),
  best ? `${best.set.join(",")}  cvd ${best.cvd} normal ${best.nv}` : "NO PASSING SET",
);
