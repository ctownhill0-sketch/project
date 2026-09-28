// Checkpoint P: builds swatch sheets + palette-themed Direction C mocks.
// Run: node docs/palettes/build.mjs, then node docs/palettes/shoot.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTES, TEXT_PAIRS, UI_PAIRS } from "./palettes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "mocks");
mkdirSync(out, { recursive: true });

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

/** Map palette tokens onto the variable names the mocks use. */
function cssVars(t, mode) {
  const map = {
    background: t.background,
    foreground: t.foreground,
    card: t.surface,
    raised: t["surface-raised"],
    muted: t.subtle,
    "muted-foreground": t["muted-foreground"],
    accent: t.accent,
    link: t.link,
    success: t.success,
    warning: t.warning,
    destructive: t.destructive,
    info: t.info,
    border: t.border,
    input: t["border-strong"],
    primary: t.primary,
    "primary-foreground": t["primary-foreground"],
    "chart-1": t["chart-1"],
    "chart-2": t["chart-2"],
  };
  let css = `:root {\n${Object.entries(map)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n")}\n  color-scheme: ${mode};\n}\n`;
  // Dark mode: borders instead of shadows (design contract).
  if (mode === "dark")
    css += `:root { --shadow-sm: 0 0 0 1px ${t["border-strong"]}; --shadow-md: 0 0 0 1px ${t.border}; --shadow-lg: 0 0 0 1px ${t.border}; }\n`;
  // Focus ring token.
  css += `:focus-visible { outline: 2px solid ${t.ring}; outline-offset: 2px; }\n`;
  return css;
}

// ---------- themed Direction C mocks ----------
const pages = ["c-dashboard", "c-leads"];
for (const [key, p] of Object.entries(PALETTES)) {
  for (const mode of ["light", "dark"]) {
    const cssFile = `palette-${key}-${mode}.css`;
    writeFileSync(path.join(out, cssFile), cssVars(p[mode], mode));
    for (const page of pages) {
      const html = readFileSync(path.join(here, "../ui-directions", `${page}.html`), "utf8").replace(
        '<link rel="stylesheet" href="mock.css">',
        `<link rel="stylesheet" href="../../ui-directions/mock.css"><link rel="stylesheet" href="${cssFile}">`,
      );
      writeFileSync(path.join(out, `${page}-${key}-${mode}.html`), html);
    }
  }
}

// ---------- swatch sheets ----------
const GROUPS = [
  ["Surfaces", ["background", "surface", "surface-raised", "subtle", "border", "border-strong"]],
  [
    "Text and action",
    [
      "foreground",
      "muted-foreground",
      "primary",
      "primary-foreground",
      "accent",
      "accent-foreground",
      "link",
      "ring",
    ],
  ],
  ["Status (always with icon + label)", ["success", "warning", "destructive", "info"]],
  ["Chart (lines)", ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]],
];
const ICON = {
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  destructive: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};
const LABEL = { success: "On track", warning: "At risk", destructive: "Missed", info: "Reply check due" };

function themePanel(t, mode) {
  const sw = GROUPS.map(
    ([title, keys]) =>
      `<div class="grp"><div class="gt">${title}</div><div class="sws">${keys.map((k) => `<div class="sw"><span class="chip" style="background:${t[k]}"></span><span class="k">${k}</span><span class="hex">${t[k]}</span></div>`).join("")}</div></div>`,
  ).join("");
  const badges = ["success", "warning", "destructive", "info"]
    .map(
      (k) =>
        `<span class="badge" style="color:${t[k]};border-color:color-mix(in srgb, ${t[k]} 45%, transparent);background:${t["surface-raised"]}"><svg viewBox="0 0 24 24" class="i">${ICON[k]}</svg>${LABEL[k]}</span>`,
    )
    .join("");
  const W = 300,
    H = 120;
  const series = [1, 2, 3, 4, 5]
    .map((i) => {
      const pts = Array.from({ length: 8 }, (_, x) => [
        20 + x * 36,
        20 + ((i * 17 + x * (9 + i * 3)) % 70) + i * 3,
      ]);
      return `<path d="${pts.map(([x, y], j) => `${j ? "L" : "M"}${x},${y}`).join(" ")}" fill="none" stroke="${t[`chart-${i}`]}" stroke-width="2"/><text x="${W - 14}" y="${pts[7][1] + 4}" font-size="11" fill="${t.foreground}" text-anchor="end">${i}</text>`;
    })
    .join("");
  const rows = [...TEXT_PAIRS, ...UI_PAIRS]
    .map(([a, b, min]) => {
      const r = ratio(t[a], t[b]);
      return `<tr><td>${a}</td><td>${b}</td><td class="r">${r.toFixed(2)}:1</td><td class="r">${min}:1</td><td>${r >= min ? "✓ pass" : "✗ FAIL"}</td></tr>`;
    })
    .join("");
  return `<section class="theme" style="background:${t.background};color:${t.foreground}">
    <h2>${mode === "light" ? "Light" : "Dark"}</h2>
    <div class="card" style="background:${t.surface};border:1px solid ${t.border}">
      ${sw}
      <div class="gt">Status badges</div><div class="row">${badges}</div>
      <div class="gt">Chart colors as 2px lines on the surface</div><svg width="${W}" height="${H}" style="background:${t.surface}">${series}</svg>
      <div class="row"><span class="btn" style="background:${t.primary};color:${t["primary-foreground"]}">Start call block</span><span class="btn" style="border:1px solid ${t["border-strong"]};color:${t.foreground};background:${t.surface}">Log a shop</span><span style="color:${t.link};text-decoration:underline">Check portal</span><span class="meter" style="background:${t.subtle}"><i style="background:${t.accent}"></i></span></div>
    </div>
    <details open class="card" style="background:${t.surface};border:1px solid ${t.border}"><summary>Measured contrast (${[...TEXT_PAIRS, ...UI_PAIRS].length} pairs)</summary>
      <table style="color:${t.foreground}"><thead><tr><th>Foreground</th><th>On</th><th class="r">Ratio</th><th class="r">Needs</th><th></th></tr></thead><tbody>${rows}</tbody></table></details>
  </section>`;
}

for (const [key, p] of Object.entries(PALETTES)) {
  writeFileSync(
    path.join(out, `swatches-${key}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><title>${p.name}</title><style>
    @font-face{font-family:Inter;src:url("../../ui-directions/inter.woff2") format("woff2");font-weight:400 600}
    *{box-sizing:border-box;margin:0}body{font-family:Inter,system-ui;font-size:13px;line-height:18px;width:1440px;background:#fff}
    header{padding:20px 28px;font-size:22px;font-weight:600;background:${p.light.background};color:${p.light.foreground}} header p{font-size:14px;font-weight:400;color:${p.light["muted-foreground"]};margin-top:4px}
    .wrap{display:grid;grid-template-columns:1fr 1fr}.theme{padding:20px 28px;display:flex;flex-direction:column;gap:14px}h2{font-size:16px}
    .card{border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}.gt{font-weight:600;font-size:12px;margin-top:4px}
    .sws{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sw{display:flex;align-items:center;gap:8px}.chip{width:28px;height:28px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.35);flex:none}
    .k{flex:1}.hex{font-variant-numeric:tabular-nums;opacity:.8}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .badge{display:inline-flex;align-items:center;gap:4px;border:1px solid;border-radius:999px;padding:0 8px;font-weight:500;font-size:12px;line-height:22px}
    .i{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .btn{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:8px;font-weight:500}
    .meter{width:120px;height:6px;border-radius:3px;overflow:hidden;display:inline-block}.meter i{display:block;height:100%;width:60%}
    table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:3px 6px;text-align:left;border-bottom:1px solid rgba(127,127,127,.2)}.r{text-align:right;font-variant-numeric:tabular-nums}
    summary{font-weight:600}
    </style></head><body><header>${p.name}<p>${p.idea}</p></header><div class="wrap">${themePanel(p.light, "light")}${themePanel(p.dark, "dark")}</div></body></html>`,
  );
}
console.log("Built palette mocks and swatch sheets.");
