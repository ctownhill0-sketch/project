// Builds six static mocks (3 directions × Dashboard/Leads). Fictional data only.
// Run: node docs/ui-directions/build.mjs, then screenshot with shoot.mjs.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- icons (lucide-style, 2px stroke) ----------
const P = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  leads:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  shops:
    '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  calls:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pipeline: '<path d="M6 5v11"/><path d="M12 5v6"/><path d="M18 5v14"/>',
  roi: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="8" x2="8" y1="14" y2="14"/><line x1="12" x2="12" y1="14" y2="14"/><line x1="16" x2="16" y1="14" y2="18"/>',
  audits:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/>',
  pilots: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  ok: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
};
const ic = (n, extra = "") =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${P[n]}</svg>`;
const status = (kind, label, icon) => `<span class="status ${kind}">${ic(icon)}${label}</span>`;

// ---------- fictional data ----------
const FIRMS = [
  {
    name: "Harborline Residential",
    town: "Brooklyn",
    sw: "Buildium",
    units: 180,
    listings: 14,
    score: 95,
    median: "4h 12m",
    shop: "Sat 22:10",
    why: "3 new listings today",
    tags: ["Brooklyn", "Call block"],
  },
  {
    name: "Quarry Oak Property Group",
    town: "Yonkers",
    sw: "None found",
    units: 90,
    listings: 7,
    score: 90,
    median: "No reply",
    shop: "Wed 19:45",
    why: "No reply to shop in 72h",
    tags: ["Westchester"],
  },
  {
    name: "Brightwater Rentals",
    town: "Jersey City",
    sw: "DoorLoop",
    units: 240,
    listings: 22,
    score: 85,
    median: "2h 40m",
    shop: "Tue 11:05",
    why: "Callback due 10:30",
    tags: ["NJ"],
  },
  {
    name: "Stonegate Park Homes",
    town: "Hoboken",
    sw: "Rent Manager",
    units: 120,
    listings: 9,
    score: 80,
    median: "6h 05m",
    shop: "Mon 20:30",
    why: "Reply check due (24h)",
    tags: ["NJ"],
  },
  {
    name: "Maple Ledger Living",
    town: "Queens",
    sw: "Yardi Breeze",
    units: 310,
    listings: 18,
    score: 75,
    median: "38m",
    shop: "Thu 10:15",
    why: "Highest score not yet called",
    tags: ["Queens"],
  },
  {
    name: "Tidewell Realty Management",
    town: "White Plains",
    sw: "Unknown",
    units: 65,
    listings: 4,
    score: 70,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Copperfield Apartments",
    town: "Newark",
    sw: "Buildium",
    units: 420,
    listings: 25,
    score: 70,
    median: "1h 55m",
    shop: "",
    why: "",
    tags: ["NJ"],
  },
  {
    name: "Northbeam Properties",
    town: "Bronx",
    sw: "None found",
    units: 150,
    listings: 11,
    score: 65,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Ashgrove Square Rentals",
    town: "New Rochelle",
    sw: "DoorLoop",
    units: 75,
    listings: 5,
    score: 60,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Lanternway Management Co",
    town: "Hempstead",
    sw: "AppFolio",
    units: 500,
    listings: 30,
    score: 0,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
    excluded: true,
  },
  {
    name: "Kestrel Harbor Living",
    town: "Staten Island",
    sw: "Rent Manager",
    units: 95,
    listings: 6,
    score: 55,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Bluestem Homes",
    town: "Huntington",
    sw: "Unknown",
    units: 55,
    listings: 3,
    score: 50,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Ironbridge Properties",
    town: "Paterson",
    sw: "Buildium",
    units: 200,
    listings: 12,
    score: 50,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
  {
    name: "Willowmere Living",
    town: "Bayonne",
    sw: "Yardi Breeze",
    units: 130,
    listings: 8,
    score: 45,
    median: "unknown",
    shop: "",
    why: "",
    tags: [],
  },
];

// ---------- shared pieces ----------
const NAV = [
  ["dashboard", "Dashboard"],
  ["leads", "Leads", "412"],
  ["shops", "Mystery shops", "3"],
  ["calls", "Calls"],
  ["pipeline", "Pipeline"],
  ["roi", "ROI"],
  ["audits", "Audits"],
  ["pilots", "Pilots", "2"],
];

function sidebar(active, { icons = false } = {}) {
  if (icons) {
    return `<aside class="sidebar icons"><div class="brand-mark">VD</div>
      ${NAV.map(([k]) => `<div class="nav-item${k === active ? " active" : ""}" style="padding:9px">${ic(k)}</div>`).join("")}
      <div style="margin-top:auto" class="nav-item">${ic("settings")}</div></aside>`;
  }
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-mark">VD</span>Vacancy Desk</div>
    <div class="search">${ic("search")}<span>Jump to…</span><span class="kbd">⌘K</span></div>
    <div class="nav-group"><div class="nav-label">Sell</div>
      ${NAV.slice(0, 5)
        .map(
          ([k, l, c]) =>
            `<div class="nav-item${k === active ? " active" : ""}">${ic(k)}${l}${c ? `<span class="nav-count num">${c}</span>` : ""}</div>`,
        )
        .join("")}
    </div>
    <div class="nav-group"><div class="nav-label">Prove</div>
      ${NAV.slice(5)
        .map(
          ([k, l, c]) =>
            `<div class="nav-item${k === active ? " active" : ""}">${ic(k)}${l}${c ? `<span class="nav-count num">${c}</span>` : ""}</div>`,
        )
        .join("")}
    </div>
    <div style="margin-top:auto" class="nav-group"><div class="nav-item">${ic("settings")}Settings</div></div>
  </aside>`;
}

const topbar = (crumbs, { search = false } = {}) => `<header class="topbar">
  <div class="crumbs">${crumbs}</div>
  ${search ? `<div class="search" style="width:320px;margin-left:24px">${ic("search")}<span>Jump to a lead, page or action…</span><span class="kbd">⌘K</span></div>` : ""}
  <div class="row" style="margin-left:auto">
    <span class="btn ghost sm">${ic("bell")}<span class="num">3</span> due</span>
    <span class="btn ghost sm" aria-label="Switch to dark theme">${ic("moon")}</span>
  </div></header>`;

function keynums(items, { big = false } = {}) {
  return `<div class="keynums">${items
    .map(
      ([label, value, note]) =>
        `<div class="keynum"><span class="small muted">${label}</span><span class="v num${big ? " big" : ""}">${value}</span>${note ? `<span class="small">${note}</span>` : ""}</div>`,
    )
    .join("")}</div>`;
}

const pageHeader = (title, sub, nums, action) => `<div class="page-header">
  <div class="col" style="gap:4px;min-width:200px"><div class="gold-rule"></div><h1 class="h1">${title}</h1><span class="muted">${sub}</span></div>
  <div class="grow">${nums}</div>
  ${action}</div>`;

const scoreCell = (s) =>
  `<span class="score"><span class="num" style="width:22px;text-align:right">${s}</span><span class="bar"><i style="width:${s}%"></i></span></span>`;

const softwareCell = (f) =>
  f.excluded ? status("neutral", "AppFolio, excluded", "ban") : `<span>${f.sw}</span>`;

// MRR chart: actual (solid navy) + 7%/week projection (dashed reference line), direct labels + legend.
function mrrChart(w = 560, h = 190) {
  const weeks = 16;
  const actual = [0, 0, 0, 0, 0, 0, 0, 0, 0, 400, 400, 400];
  const proj = Array.from({ length: 5 }, (_, i) => 400 * 1.07 ** i); // from week 12 forward
  const max = 600;
  const pad = { l: 44, r: 84, t: 12, b: 26 };
  const x = (i) => pad.l + (i / (weeks - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = (pts) =>
    pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const grid = [0, 200, 400, 600]
    .map(
      (v) =>
        `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--border)" stroke-width="1"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted-foreground)" class="num">$${v}</text>`,
    )
    .join("");
  const xlabels = [0, 5, 11, 15]
    .map(
      (i) =>
        `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted-foreground)">${["Jul 6", "Aug 10", "Sep 21", "Oct 19"][[0, 5, 11, 15].indexOf(i)]}</text>`,
    )
    .join("");
  const a = actual.map((v, i) => [i, v]);
  const p = proj.map((v, i) => [11 + i, v]);
  return `<svg width="${w}" height="${h}" role="img" aria-label="MRR by week with a 7% weekly growth projection">
    ${grid}${xlabels}
    <line x1="${x(11)}" x2="${x(11)}" y1="${pad.t}" y2="${h - pad.b}" style="stroke:var(--border)" stroke-dasharray="2 3"/>
    <path d="${line(p)}" fill="none" style="stroke:var(--chart-2)" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="${line(a)}" fill="none" style="stroke:var(--chart-1)" stroke-width="2"/>
    <circle cx="${x(11)}" cy="${y(400)}" r="4" style="fill:var(--chart-1);stroke:var(--card)" stroke-width="2"/>
    <text x="${x(15) + 6}" y="${y(proj[4]) + 4}" font-size="12" style="fill:var(--foreground)" font-weight="500">7% a week</text>
    <text x="${x(11) - 6}" y="${y(400) - 10}" font-size="12" style="fill:var(--foreground)" font-weight="500" text-anchor="end">MRR $400</text>
  </svg>
  <div class="row small muted" style="gap:16px"><span class="row" style="gap:6px"><svg width="18" height="4"><line x1="0" x2="18" y1="2" y2="2" style="stroke:var(--chart-1)" stroke-width="2"/></svg>MRR</span><span class="row" style="gap:6px"><svg width="18" height="4"><line x1="0" x2="18" y1="2" y2="2" style="stroke:var(--chart-2)" stroke-width="2" stroke-dasharray="4 3"/></svg>7% weekly growth projection</span><span class="link">View as table</span></div>`;
}

const meter = (label, value, of, pct, note) => `<div class="meter">
  <div class="row"><span>${label}</span><span class="num" style="margin-left:auto"><b style="font-weight:600">${value}</b> <span class="muted">of ${of}</span></span></div>
  <div class="meter-track"><i style="width:${pct}%"></i></div>${note ? `<span class="small muted">${note}</span>` : ""}</div>`;

const killTest = `<div class="col" style="gap:14px">
  ${meter("Paid pilots", "0", "3", 2)}
  ${meter("Decision-maker conversations", "4", "60", 7)}
  <div class="row"><span>After-hours median reply</span><span style="margin-left:auto" class="num"><b style="font-weight:600">4h 12m</b></span></div>
  <div class="row small">${status("ok", "Above 10 min threshold", "ok")}<span class="muted">from 8 after-hours shops</span></div>
</div>`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="mock.css"></head><body>${body}</body></html>`;
}

const dashNums = keynums([
  [
    "MRR",
    "$400",
    `<span class="row" style="gap:4px;color:var(--destructive)">${ic("down")}Below 7% target</span>`,
  ],
  ["Week over week", "0.0%", '<span class="muted">target 7.0%</span>'],
  ["Day", "3 of 90", '<span class="muted">87 days to Dec 28</span>'],
  ["Calls this week", "25", '<span class="muted">4 conversations</span>'],
]);

// ======================= Direction A: Command center =======================
function aDashboard() {
  const today = FIRMS.slice(0, 5)
    .map(
      (
        f,
        i,
      ) => `<tr${i === 0 ? ' class="sel"' : ""}><td><div class="firm">${f.name}</div><div class="sub">${f.town}. ${f.why}</div></td>
      <td>${i === 0 ? status("warn", "Call now", "bell") : i === 2 ? status("neutral", "Callback", "calls") : i === 3 ? status("neutral", "Reply check", "shops") : status("neutral", "Top score", "ok")}</td>
      <td class="r num">${f.median}</td><td class="r">${scoreCell(f.score)}</td></tr>`,
    )
    .join("");
  const week = [
    ["Calls", "25", "18", "+7"],
    ["Conversations", "4", "2", "+2"],
    ["Audits sent", "1", "0", "+1"],
    ["Pilots live", "2", "0", "+2"],
    ["Median reply, clients", "41s", "unknown", ""],
    ["Insurance study hours", "3.0", "4.5", "−1.5"],
  ]
    .map(
      ([k, a, b, d]) =>
        `<tr><td>${k}</td><td class="r num">${a}</td><td class="r num muted">${b}</td><td class="r num">${d}</td></tr>`,
    )
    .join("");
  return page(
    "A dashboard",
    `<div class="app">${sidebar("dashboard")}<div class="main">${topbar("<b>Dashboard</b>")}
    <div class="content">
      ${pageHeader("Dashboard", "Monday, Sep 28. Call block Tue–Thu 9:00–11:30.", dashNums, `<span class="btn primary">${ic("calls")}Start call block</span>`)}
      <div class="row" style="gap:20px;align-items:stretch;flex:1;min-height:0">
        <section class="section grow" style="flex:1.45;min-width:0">
          <div class="section-head"><h2 class="h2">Today</h2><span class="muted num">5 of 12 due</span><span class="link small" style="margin-left:auto">Open call list</span></div>
          <div class="panel" style="overflow:hidden"><table><thead><tr><th>Firm</th><th>Why now</th><th class="r">Shop median</th><th class="r">Score</th></tr></thead><tbody>${today}</tbody></table></div>
          <div class="section-head" style="margin-top:6px"><h2 class="h2">This week</h2><span class="muted">vs last week</span></div>
          <div class="panel"><table><thead><tr><th>Measure</th><th class="r">This week</th><th class="r">Last week</th><th class="r">Change</th></tr></thead><tbody>${week}</tbody></table></div>
        </section>
        <section class="section" style="width:440px;flex:none">
          <div class="section-head"><h2 class="h2">Day-90 kill test</h2><span class="muted">deadline Dec 28</span></div>
          <div class="panel" style="padding:16px">${killTest}</div>
          <div class="section-head" style="margin-top:6px"><h2 class="h2">MRR vs 7% a week</h2></div>
          <div class="panel" style="padding:12px 14px">${mrrChart(410, 170)}</div>
        </section>
      </div>
    </div></div></div>`,
  );
}

function leadRows(sel = 0, n = 14) {
  return FIRMS.slice(0, n)
    .map(
      (
        f,
        i,
      ) => `<tr${i === sel ? ' class="sel"' : ""}><td style="width:28px"><input type="checkbox" aria-label="Select ${f.name}"></td>
      <td><div class="firm">${f.name}</div><div class="sub">${f.town}</div></td>
      <td>${softwareCell(f)}</td><td class="r num">${f.units}<span class="estimated">Est.</span></td><td class="r num">${f.listings}</td>
      <td class="r num">${f.median === "unknown" ? '<span class="muted">unknown</span>' : f.median}</td>
      <td>${f.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")}</td><td class="r">${scoreCell(f.score)}</td></tr>`,
    )
    .join("");
}

const leadNums = keynums([
  ["Leads", "412"],
  ["Ready to call", "87"],
  ["Excluded (AppFolio)", "61"],
  ["Possible duplicates", "5", '<span class="link">Review</span>'],
]);

const filterBar = `<div class="filters"><div class="search" style="width:280px">${ic("search")}<span>Search firms, towns, domains</span></div>
  <span class="chip on">Status <b>Ready</b></span><span class="chip on">Software <b>Not AppFolio</b></span><span class="chip">Metro</span><span class="chip">Tags</span><span class="chip">Score</span>
  <span class="link small" style="margin-left:auto">Export CSV</span></div>`;

function leadDetail({ overlay }) {
  const f = FIRMS[0];
  return `<div class="${overlay ? "sheet" : "col"}" style="${overlay ? "" : "gap:16px;padding:20px 22px;height:100%"}">
    <div class="row" style="align-items:flex-start"><div class="col grow" style="gap:4px"><span class="small muted">Lead</span><h2 class="h1" style="font-size:22px;line-height:30px">${f.name}</h2>
      <div class="row small muted">${f.town}, NY<span>harborline-residential.example</span></div></div>
      ${overlay ? `<span class="btn ghost sm" aria-label="Close">${ic("x")}</span>` : ""}</div>
    <div class="row">${status("warn", "Call now", "bell")}<span class="tag">Brooklyn</span><span class="tag">Call block</span></div>
    <div class="row" style="gap:8px"><span class="btn primary">${ic("calls")}Call (212) 555-0142</span><span class="btn">Log a shop</span><span class="btn">Move to…</span></div>
    <div class="rule"></div>
    <div class="section"><div class="section-head"><h3 class="h2">Why call now</h3></div>
      <div class="dl"><dt>Score</dt><dd class="num">95 of 100 <span class="link small">See breakdown</span></dd>
      <dt>Shop median</dt><dd class="num">4h 12m, after-hours <span class="muted">(1 shop, Sat 22:10)</span></dd>
      <dt>Listings</dt><dd class="num">14 live<span class="estimated">Estimated</span>, 3 new today</dd>
      <dt>Software</dt><dd>Buildium <span class="link small">Check portal ${ic("ext", 'style="width:12px;height:12px"')}</span></dd>
      <dt>Units</dt><dd class="num">180<span class="estimated">Estimated</span></dd></div></div>
    <div class="rule"></div>
    <div class="section"><div class="section-head"><h3 class="h2">Opener</h3><span class="small muted">with test result</span></div>
      <div class="script">Hi <mark>Jordan</mark>, I sent an inquiry on one of your listings on <mark>Saturday at 10:10 pm</mark> and the first reply took <mark>4 hours 12 minutes</mark>. Renters usually pick whoever answers first. Do you have two minutes?</div></div>
    <div class="section"><div class="section-head"><h3 class="h2">Log the call</h3><span class="small muted">press a number</span></div>
      <div class="hotkeys">${["No answer", "Voicemail", "Gatekeeper", "Callback", "Conversation", "Audit booked"].map((d, i) => `<span class="hotkey"><span class="kbd">${i + 1}</span>${d}</span>`).join("")}</div></div>
  </div>`;
}

function aLeads() {
  return page(
    "A leads",
    `<div class="app" style="position:relative">${sidebar("leads")}<div class="main">${topbar("<b>Leads</b>")}
    <div class="content">
      ${pageHeader("Leads", "Scored, deduplicated NYC-metro firms.", leadNums, `<span class="btn primary">${ic("upload")}Import CSV</span>`)}
      ${filterBar}
      <div class="panel" style="overflow:hidden"><table><thead><tr><th></th><th>Firm</th><th>Software</th><th class="r">Units</th><th class="r">Listings</th><th class="r">Shop median</th><th>Tags</th><th class="r">Score</th></tr></thead><tbody>${leadRows(0, 13)}</tbody></table></div>
    </div></div>
    <div class="scrim"></div>${leadDetail({ overlay: true })}</div>`,
  );
}

// ======================= Direction B: Focus mode =======================
function bDashboard() {
  const f = FIRMS[0];
  const queue = FIRMS.slice(1, 5)
    .map(
      (q, i) =>
        `<div class="row" style="padding:10px 0;border-top:1px solid var(--border)"><span class="num muted" style="width:20px">${i + 2}</span><div class="col grow"><span class="firm">${q.name}</span><span class="sub">${q.why}</span></div><span class="num">${scoreCell(q.score)}</span></div>`,
    )
    .join("");
  return page(
    "B dashboard",
    `<div class="app">${sidebar("dashboard", { icons: true })}<div class="main">${topbar("<b>Dashboard</b>", { search: true })}
    <div class="content" style="align-items:center">
      <div class="col" style="width:1040px;gap:18px">
        ${pageHeader(
          "Good morning",
          "Call block starts in 22 minutes.",
          keynums([
            [
              "MRR",
              "$400",
              `<span class="row" style="gap:4px;color:var(--destructive)">${ic("down")}Below 7% target</span>`,
            ],
            ["Day", "3 of 90"],
            ["Conversations", "4 of 60"],
            ["Pilots", "0 of 3"],
          ]),
          `<span class="btn primary">${ic("calls")}Call Harborline</span>`,
        )}
        <div class="row" style="gap:20px;align-items:flex-start">
          <section class="panel col" style="flex:1.6;padding:24px 28px;gap:16px;box-shadow:var(--shadow-md);border-color:transparent">
            <div class="row"><span class="small muted">Next up, 1 of 12</span>${status("warn", "Call now", "bell")}</div>
            <div class="col" style="gap:4px"><h2 style="font-size:36px;line-height:44px;font-weight:600">${f.name}</h2><span class="muted">${f.town}, NY. Buildium. 180 units<span class="estimated">Estimated</span></span></div>
            <div class="row" style="gap:32px;padding:6px 0">
              <div class="col"><span class="small muted">Their after-hours reply</span><span class="num" style="font-size:48px;line-height:56px;font-weight:600">4h 12m</span></div>
              <div class="col"><span class="small muted">New listings today</span><span class="num" style="font-size:48px;line-height:56px;font-weight:600">3</span></div>
              <div class="col"><span class="small muted">Score</span><span class="num" style="font-size:48px;line-height:56px;font-weight:600">95</span></div>
            </div>
            <div class="script">Hi <mark>Jordan</mark>, I sent an inquiry on <mark>Saturday at 10:10 pm</mark> and the first reply took <mark>4 hours 12 minutes</mark>. Do you have two minutes?</div>
            <div class="row" style="gap:10px"><span class="btn" style="height:44px">Open lead</span><span class="btn" style="height:44px">${ic("skip")}Skip to next</span><span class="small muted" style="margin-left:auto">(212) 555-0142. After the call, press 1–9 to log it.</span></div>
          </section>
          <section class="col" style="flex:1;gap:18px">
            <div class="section"><div class="section-head"><h2 class="h2">Then</h2><span class="muted">11 more today</span></div><div>${queue}</div></div>
            <div class="section"><div class="section-head"><h2 class="h2">Kill test</h2></div>${killTest}</div>
          </section>
        </div>
        <details class="panel" style="padding:12px 16px"><summary class="h2">Growth and this week</summary></details>
      </div>
    </div></div></div>`,
  );
}

function bLeads() {
  const f = FIRMS[3];
  const rail = FIRMS.slice(0, 12)
    .map(
      (q, i) =>
        `<div class="row" style="padding:8px 10px;border-radius:8px;${i === 3 ? "background:var(--muted);box-shadow:inset 2px 0 0 var(--accent)" : ""}"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.name}</span>${i < 3 ? status("ok", "Done", "ok") : ""}</div>`,
    )
    .join("");
  return page(
    "B leads",
    `<div class="app">${sidebar("leads", { icons: true })}<div class="main">${topbar("<b>Leads</b>", { search: true })}
    <div class="content">
      ${pageHeader(
        "Review new leads",
        "Import of Sep 28: confirm software and tags, one firm at a time.",
        keynums([
          ["To review", "44"],
          ["Reviewed", "3"],
          ["Excluded", "1"],
          ["Duplicates", "2"],
        ]),
        `<span class="btn primary">Keep and next</span>`,
      )}
      <div class="row" style="gap:20px;align-items:stretch;flex:1;min-height:0">
        <aside class="panel col" style="width:280px;padding:10px;gap:2px"><div class="small muted" style="padding:4px 10px 8px">Queue <span class="num">4 of 47</span></div>${rail}</aside>
        <section class="panel col grow" style="padding:24px 28px;gap:18px">
          <div class="row"><div class="col grow" style="gap:4px"><span class="small muted">Lead 4 of 47</span><h2 style="font-size:28px;line-height:36px;font-weight:600">${f.name}</h2><span class="muted">${f.town}, NJ. stonegate-park-homes.example</span></div>
            <span class="link">Check portal ${ic("ext", 'style="width:12px;height:12px"')}</span></div>
          <div class="row" style="gap:28px">
            <div class="col" style="gap:6px;width:260px"><label class="small muted">Property software</label><div class="btn" style="justify-content:space-between">Rent Manager<span class="muted">▾</span></div><span class="small muted">From the CSV. Change it if the portal says otherwise.</span></div>
            <div class="col" style="gap:6px;width:260px"><label class="small muted">Status</label><div class="btn" style="justify-content:space-between">Ready to call<span class="muted">▾</span></div></div>
          </div>
          <div class="dl"><dt>Score</dt><dd class="num">80 <span class="muted">(not AppFolio +30, 3–25 listings +20, slow reply +25, local +10)</span></dd><dt>Units</dt><dd class="num">120<span class="estimated">Estimated</span></dd><dt>Listings</dt><dd class="num">9<span class="estimated">Estimated</span></dd><dt>Tags</dt><dd><span class="tag">NJ</span> <span class="link small">Add tag</span></dd></div>
          <div class="rule"></div>
          <div class="row" style="gap:10px;margin-top:auto"><span class="small muted">Keep and next <span class="kbd" style="margin-left:4px">↵</span></span><span class="btn" style="height:44px;margin-left:12px">Exclude<span class="kbd" style="margin-left:8px">E</span></span><span class="btn ghost" style="height:44px">Skip<span class="kbd" style="margin-left:8px">S</span></span><span class="link small" style="margin-left:auto">See all 412 leads as a table</span></div>
        </section>
      </div>
    </div></div></div>`,
  );
}

// ======================= Direction C: Split view =======================
function cDashboard() {
  const list = FIRMS.slice(0, 7)
    .map(
      (
        f,
        i,
      ) => `<div class="row" style="padding:10px 14px;border-bottom:1px solid var(--border);${i === 0 ? "background:var(--muted);box-shadow:inset 2px 0 0 var(--accent)" : ""}">
      <div class="col grow"><span class="firm">${f.name}</span><span class="sub">${f.why || "Top score, not called"}</span></div>
      <div class="col" style="align-items:flex-end;gap:2px">${i === 0 ? status("warn", "Call now", "bell") : i === 2 ? status("neutral", "10:30", "calls") : ""}<span class="num small muted">${f.score}</span></div></div>`,
    )
    .join("");
  return page(
    "C dashboard",
    `<div class="app">${sidebar("dashboard")}<div class="main">${topbar("<b>Dashboard</b>")}
    <div class="content" style="gap:14px">
      ${pageHeader("Dashboard", "Monday, Sep 28", dashNums, `<span class="btn primary">${ic("calls")}Start call block</span>`)}
      <div class="panel row" style="align-items:stretch;flex:1;min-height:0;gap:0;overflow:hidden">
        <section class="col" style="width:340px;flex:none;border-right:1px solid var(--border)">
          <div class="row" style="padding:12px 14px;border-bottom:1px solid var(--border)"><h2 class="h2">Today</h2><span class="muted num">12 due</span>
            <span class="row small" style="margin-left:auto;gap:4px"><span class="chip on" style="height:26px">All</span><span class="chip" style="height:26px">Calls</span><span class="chip" style="height:26px">Checks</span></span></div>
          ${list}
        </section>
        <section class="col grow">${leadDetail({ overlay: false })}</section>
        <section class="col" style="width:360px;flex:none;border-left:1px solid var(--border);padding:16px 18px;gap:16px">
          <div class="section"><div class="section-head"><h2 class="h2">Kill test</h2><span class="muted small">Dec 28</span></div>${killTest}</div>
          <div class="rule"></div>
          <div class="section"><div class="section-head"><h2 class="h2">MRR vs 7%</h2></div>${mrrChart(324, 150)}</div>
        </section>
      </div>
    </div></div></div>`,
  );
}

function cLeads() {
  const rows = FIRMS.slice(0, 14)
    .map(
      (
        f,
        i,
      ) => `<tr${i === 0 ? ' class="sel"' : ""}><td><div class="firm">${f.name}</div><div class="sub">${f.town}</div></td><td>${softwareCell(f)}</td>
      <td class="r num">${f.median === "unknown" ? '<span class="muted">unknown</span>' : f.median}</td><td class="r">${scoreCell(f.score)}</td></tr>`,
    )
    .join("");
  return page(
    "C leads",
    `<div class="app">${sidebar("leads")}<div class="main">${topbar("<b>Leads</b>")}
    <div class="content" style="gap:14px">
      ${pageHeader("Leads", "Scored, deduplicated NYC-metro firms.", leadNums, `<span class="btn primary">${ic("upload")}Import CSV</span>`)}
      ${filterBar}
      <div class="panel row" style="align-items:stretch;flex:1;min-height:0;gap:0;overflow:hidden">
        <section style="width:640px;flex:none;border-right:1px solid var(--border);overflow:hidden"><table><thead><tr><th>Firm</th><th>Software</th><th class="r">Shop median</th><th class="r">Score</th></tr></thead><tbody>${rows}</tbody></table></section>
        <div style="width:6px;background:var(--muted);display:grid;place-items:center" aria-label="Resize"><div style="width:2px;height:28px;background:var(--input);border-radius:1px"></div></div>
        <section class="col grow">${leadDetail({ overlay: false })}</section>
      </div>
    </div></div></div>`,
  );
}

const out = {
  "a-dashboard.html": aDashboard(),
  "a-leads.html": aLeads(),
  "b-dashboard.html": bDashboard(),
  "b-leads.html": bLeads(),
  "c-dashboard.html": cDashboard(),
  "c-leads.html": cLeads(),
};
for (const [name, html] of Object.entries(out)) writeFileSync(path.join(here, name), html);
console.log(`Wrote ${Object.keys(out).length} mocks.`);
