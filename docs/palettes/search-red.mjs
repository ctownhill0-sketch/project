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
  const lin = [l_ ** 3, m_ ** 3, s_ ** 3];
  const [l, m, s] = lin;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (rgb.some((v) => v < -0.001 || v > 1.001)) return null;
  return (
    "#" +
    rgb
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
// 10% tint of the red over white (what bg-destructive/10 renders).
const tint = (hex) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.1 + 255 * 0.9)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const others = { success: "#2D8014", warning: "#774500", info: "#3A6FA3" };
const res = [];
for (const H of [22, 25, 28, 31])
  for (const L of [0.48, 0.5, 0.52, 0.54, 0.56])
    for (const C of [0.15, 0.17, 0.19, 0.21]) {
      const red = oklchToHex(L, C, H);
      if (!red) continue;
      const worstText = Math.min(
        contrast(red, "#F6F6F7"),
        contrast(red, "#FFFFFF"),
        contrast(red, tint(red)),
      );
      if (worstText < 4.5) continue;
      const white = contrast("#FFFFFF", red);
      const rep = validate([others.success, others.warning, red, others.info], {
        mode: "light",
        surface: "#FFFFFF",
        pairs: "all",
      });
      const cvd = Number(/ΔE ([\d.]+)/.exec(rep.report.find((r) => r[0] === "CVD separation")[2])[1]);
      const nv = Number(/ΔE ([\d.]+)/.exec(rep.report.find((r) => r[0] === "Normal-vision floor")[2])[1]);
      res.push({ red, worstText: +worstText.toFixed(2), white: +white.toFixed(2), cvd, nv });
    }
res.sort((a, b) => b.cvd - a.cvd);
console.table(res.slice(0, 6));
