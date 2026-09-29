// Website enrichment from public pages (finder spec §5). Pure: HTML in, facts with sources out.
// Every value carries the page it came from and a quote; nothing is invented.
import { parse, type HTMLElement } from "node-html-parser";
import { normalizePhone } from "@/lib/domain/dedupe";
import type { Software } from "@/lib/domain/scoring";
import { SOFTWARE_NAMES, type SoftwarePatternInput } from "@/lib/domain/software";

export type Confidence = "high" | "medium" | "low";

export interface ParsedPage {
  url: string;
  root: HTMLElement;
  text: string;
  links: { href: string; text: string }[];
  scripts: string[];
}

export interface Sourced<T> {
  value: T;
  sourceUrl: string;
  quote: string;
}

function absolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function parsePage(url: string, html: string): ParsedPage {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: false, style: false, noscript: false },
  });
  const links = root
    .querySelectorAll("a[href]")
    .map((a) => ({ href: a.getAttribute("href") ?? "", text: a.text.trim() }))
    .filter((l) => l.href);
  const scripts = root
    .querySelectorAll("script[src], iframe[src]")
    .map((s) => s.getAttribute("src") ?? "")
    .filter(Boolean);
  const text = root.text.replace(/\s+/g, " ").trim();
  return { url, root, text, links, scripts };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function urlMatches(url: string, p: SoftwarePatternInput): boolean {
  if (p.kind === "domain") {
    const host = hostOf(url);
    const d = p.pattern.toLowerCase();
    return Boolean(host && (host === d || host.endsWith(`.${d}`)));
  }
  return url.toLowerCase().includes(p.pattern.toLowerCase());
}

export interface SoftwareResult {
  software: Software;
  confidence: Confidence;
  /** The portal/listing URL (or the text quote) that proves it. */
  evidence: string | null;
  sourceUrl: string | null;
}

export function detectSoftware(pages: ParsedPage[], patterns: SoftwarePatternInput[]): SoftwareResult {
  const hits = new Map<Software, { evidence: string; sourceUrl: string; count: number }>();
  for (const page of pages) {
    const urls = [...page.links.map((l) => l.href), ...page.scripts]
      .map((u) => absolute(u, page.url))
      .filter((u): u is string => Boolean(u));
    for (const url of urls) {
      const p = patterns.find((pattern) => urlMatches(url, pattern));
      if (!p) continue;
      const hit = hits.get(p.software);
      if (hit) hit.count += 1;
      else hits.set(p.software, { evidence: url, sourceUrl: page.url, count: 1 });
    }
  }
  if (hits.size > 0) {
    const [software, best] = [...hits.entries()].sort((a, b) => b[1].count - a[1].count)[0]!;
    return {
      software,
      confidence: hits.size > 1 ? "low" : "high",
      evidence: best.evidence,
      sourceUrl: best.sourceUrl,
    };
  }
  for (const page of pages) {
    for (const [software, re] of Object.entries(SOFTWARE_NAMES) as [Software, RegExp][]) {
      const m = re.exec(page.text);
      if (m)
        return {
          software,
          confidence: "medium",
          evidence: quoteAround(page.text, m.index, m[0].length),
          sourceUrl: page.url,
        };
    }
  }
  if (pages.length >= 2)
    return { software: "none", confidence: "medium", evidence: null, sourceUrl: pages[0]!.url };
  return { software: "unknown", confidence: "low", evidence: null, sourceUrl: pages[0]?.url ?? null };
}

function quoteAround(text: string, index: number, length: number, pad = 40): string {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - pad)) + 1);
  const endSpace = text.indexOf(" ", Math.min(text.length, index + length + pad));
  return text.slice(start, endSpace < 0 ? text.length : endSpace).trim();
}

const UNIT = String.raw`(?:rental\s+)?(?:units|doors|homes|apartments|residences|properties|rentals)`;
const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
const SIZE_PATTERNS = [
  new RegExp(
    String.raw`(?:manage|managing|manages|oversee|overseeing|oversees|portfolio of|responsible for)\b[^.]{0,30}?${NUM}\+?\s+${UNIT}`,
    "gi",
  ),
  new RegExp(String.raw`${NUM}\+\s+${UNIT}`, "gi"),
  new RegExp(String.raw`${NUM}\s+${UNIT}\s+under\s+management`, "gi"),
];
const MIN_SIZE = 5;
const MAX_SIZE = 50_000;

/** "We manage over 300 doors" → 300 (Estimated). The largest plausible figure wins. */
export function extractSize(pages: ParsedPage[]): Sourced<number> | null {
  let best: Sourced<number> | null = null;
  for (const page of pages) {
    for (const re of SIZE_PATTERNS) {
      for (const m of page.text.matchAll(re)) {
        const value = Number(m[1]!.replace(/,/g, ""));
        if (value < MIN_SIZE || value > MAX_SIZE) continue;
        if (!best || value > best.value) best = { value, sourceUrl: page.url, quote: m[0].trim() };
      }
    }
  }
  return best;
}

const LISTING_SELECTORS = [
  ".listing-item",
  ".js-listing-item",
  ".featured-listing",
  ".property-listing",
  ".unit-card",
  ".rental-listing",
];

/** Live listing count on a rentals page (Estimated): known widgets first, then "12 available rentals". */
export function countListings(page: ParsedPage): Sourced<number> | null {
  for (const selector of LISTING_SELECTORS) {
    const n = page.root.querySelectorAll(selector).length;
    if (n > 0) return { value: n, sourceUrl: page.url, quote: `${n} × ${selector}` };
  }
  const m =
    /(\d{1,4})\s+(?:available\s+)?(?:rentals|listings|units|homes|apartments)\s+(?:available|for rent)|(\d{1,4})\s+available\s+(?:rentals|listings|units|homes|apartments)/i.exec(
      page.text,
    );
  if (m) return { value: Number(m[1] ?? m[2]), sourceUrl: page.url, quote: m[0] };
  return null;
}

const GENERIC_LOCAL =
  /^(info|office|leasing|rentals?|contact|hello|admin|management|pm|properties|support|team|inquiries|service|maintenance)$/i;

/** Business phones (tel: links) and general business emails only. Personal addresses are dropped. */
export function extractContacts(pages: ParsedPage[]): {
  phones: Sourced<string>[];
  emails: Sourced<string>[];
} {
  const phones = new Map<string, Sourced<string>>();
  const emails = new Map<string, Sourced<string>>();
  for (const page of pages) {
    for (const link of page.links) {
      const href = link.href.trim();
      if (/^tel:/i.test(href)) {
        const value = normalizePhone(decodeURIComponent(href.slice(4)));
        if (value && !phones.has(value)) phones.set(value, { value, sourceUrl: page.url, quote: href });
      } else if (/^mailto:/i.test(href)) {
        const address = decodeURIComponent(href.slice(7)).split("?")[0]!.trim().toLowerCase();
        const [local, domain] = address.split("@");
        if (!local || !domain || !GENERIC_LOCAL.test(local)) continue;
        if (!emails.has(address)) emails.set(address, { value: address, sourceUrl: page.url, quote: href });
      }
    }
  }
  return { phones: [...phones.values()], emails: [...emails.values()] };
}

/** The firm's own name for itself: og:site_name, else the <title> without "Home" suffixes. */
export function extractName(page: ParsedPage): string | null {
  const og = page.root.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim();
  if (og) return og;
  const title = page.root.querySelector("title")?.text.trim();
  if (!title) return null;
  const parts = title
    .split(/\s[|–—-]\s/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(home|welcome|homepage)$/i.test(p));
  return parts[0] ?? null;
}

const SERVICE_HINTS: [string, RegExp][] = [
  ["residential", /\bresidential\b|\bsingle[- ]family\b|\bapartment management\b/i],
  ["hoa", /\bHOA\b|\bhomeowners? association\b|\bcondo(?:minium)? association\b|\bassociation management\b/],
  ["commercial", /\bcommercial (?:property|real estate|management|leasing)\b/i],
  ["vacation", /\bvacation rentals?\b|\bshort[- ]term rentals?\b/i],
];

export function extractServiceTypes(pages: ParsedPage[]): Sourced<string>[] {
  const found = new Map<string, Sourced<string>>();
  for (const page of pages) {
    for (const [value, re] of SERVICE_HINTS) {
      if (found.has(value)) continue;
      const m = re.exec(page.text);
      if (m)
        found.set(value, {
          value,
          sourceUrl: page.url,
          quote: quoteAround(page.text, m.index, m[0].length, 20),
        });
    }
  }
  return [...found.values()];
}

const PAGE_PRIORITY = [
  "rentals",
  "available",
  "vacancies",
  "listings",
  "pay-rent",
  "residents",
  "tenants",
  "owners",
  "about",
];

/** Up to 3 likely pages on the same host, in priority order (rentals first). */
export function likelyPages(home: ParsedPage, max = 3): string[] {
  const host = hostOf(home.url);
  const candidates = new Map<string, number>();
  for (const link of home.links) {
    const url = absolute(link.href, home.url);
    if (!url || hostOf(url) !== host) continue;
    const path = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
    const slug = path.split("/").filter(Boolean)[0];
    const rank = slug ? PAGE_PRIORITY.indexOf(slug) : -1;
    if (rank < 0) continue;
    const clean = new URL(url);
    clean.hash = "";
    const key = clean.toString();
    if (!candidates.has(key) || candidates.get(key)! > rank) candidates.set(key, rank);
  }
  return [...candidates.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, max)
    .map(([url]) => url);
}
