import { execFileSync } from "node:child_process";
const V = process.env.VALIDATOR;
const lum = (h) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const [mode, surface] = process.argv.slice(2);
const C =
  mode === "light"
    ? {
        s: ["#1A7A3C", "#15803D", "#0F7A45", "#2E7D32"],
        w: ["#8A5A00", "#7A4D00", "#9A5B00", "#865400", "#7C5800", "#946200"],
        d: ["#B42318", "#C4281C", "#D1342A", "#CF3A30", "#A61B1B", "#C2372E"],
        i: ["#1F5FAD", "#2360B8", "#1D5AA8", "#0B6BA8"],
      }
    : {
        s: ["#3FB26A", "#43B870", "#38A865", "#4AAE6E"],
        w: ["#D39A2C", "#C98F1F", "#D8A23A", "#CC9A30"],
        d: ["#F0645A", "#E8594F", "#F27468", "#E5655C"],
        i: ["#5A9BEA", "#5E9CEB", "#4F92E3", "#6AA3EE"],
      };
const ok = [];
for (const s of C.s)
  for (const w of C.w)
    for (const d of C.d)
      for (const i of C.i) {
        if ([s, w, d, i].some((c) => ratio(c, surface) < 4.5)) continue;
        try {
          const out = execFileSync(
            "node",
            [V, [s, w, d, i].join(","), "--mode", mode, "--surface", surface, "--pairs", "all"],
            { encoding: "utf8" },
          );
          const cvd = Number(
            /CVD separation\s+worst \S+ \S+ ΔE ([\d.]+)/.exec(out)?.[1] ?? /ΔE ([\d.]+)/.exec(out)?.[1],
          );
          ok.push({
            set: [s, w, d, i],
            cvd,
            out: out
              .split("\n")
              .filter((l) => /CVD|Normal/.test(l))
              .join(" | "),
          });
        } catch {}
      }
ok.sort((a, b) => b.cvd - a.cvd);
console.log(`${mode}: ${ok.length} passing sets`);
for (const o of ok.slice(0, 3)) console.log(o.set.join(","), "\n  ", o.out);
