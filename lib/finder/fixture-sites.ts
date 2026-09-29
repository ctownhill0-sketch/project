// Fixture websites for the fixture Places firms (demo + e2e; no internet). Deterministic per domain:
// each site links a vendor portal, states a size, lists some rentals and a generic email.
import type { FetchResult } from "@/lib/fetcher/fetcher";
import type { PageSource } from "@/lib/finder/service";

const VENDORS = [
  ["buildium", "https://{d}.managebuilding.com/Resident/portal/login"],
  ["appfolio", "https://{d}.appfolio.com/connect"],
  ["doorloop", "https://app.doorloop.com/tenant-portal/{d}"],
  ["rent_manager", "https://{d}.rmresident.com/"],
  ["yardi", "https://{d}.securecafe.com/residentservices/"],
  ["none", ""],
  ["rentvine", "https://{d}.rentvine.com/portals/resident"],
  ["buildium", "https://{d}.managebuilding.com/Resident/portal/login"],
  ["tenantcloud", "https://home.tenantcloud.com/login"],
] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // Final avalanche (murmur3 fmix32) so similar names spread across vendors.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function fixtureSite(url: string): Record<string, string> | null {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (!host.endsWith(".example")) return null;
  const h = hash(host);
  if (h % 13 === 0) return null; // some sites are down
  const slug = host.replace(/\.example$/, "");
  const name = slug.replace(
    /(^|-)(\w)/g,
    (_, sep: string, c: string) => `${sep ? " " : ""}${c.toUpperCase()}`,
  );
  const [, portal] = VENDORS[h % VENDORS.length]!;
  const units = 40 + (h % 420);
  const listings = h % 18;
  const origin = `https://www.${host}`;
  const home = `<html><head><title>${name} | Property Management</title><meta property="og:site_name" content="${name} Property Management"></head><body>
    <nav><a href="/rentals">Available rentals</a><a href="/owners">For owners</a><a href="/about">About</a>
    ${portal ? `<a href="${portal.replace("{d}", slug)}">Pay rent</a>` : ""}</nav>
    <p>Residential property management in North Jersey. We manage over ${units} doors for local owners.</p>
    <a href="tel:+1201555${String(100 + (h % 100)).padStart(4, "0")}">Call the office</a>
    <a href="mailto:info@${host}">info@${host}</a></body></html>`;
  const rentals = `<html><body><h1>Available rentals</h1>${Array.from({ length: listings }, (_, i) => `<div class="listing-item">Unit ${i + 1}</div>`).join("")}</body></html>`;
  return {
    [`${origin}/`]: home,
    [`${origin}/rentals`]: rentals,
    [`${origin}/owners`]: `<html><body><p>Owner services for ${name}.</p></body></html>`,
    [`${origin}/about`]: `<html><body><p>Family-run since 2004.</p></body></html>`,
  };
}

export function fixturePageSource(): PageSource {
  return {
    async get(url: string): Promise<FetchResult> {
      const site = fixtureSite(url);
      const html = site?.[url];
      if (!site)
        return {
          ok: false,
          url,
          reason: "network",
          status: null,
          bytes: 0,
          ms: 3,
          message: "Site unreachable (fixture)",
        };
      if (!html) return { ok: false, url, reason: "http", status: 404, bytes: 0, ms: 3 };
      return { ok: true, url, status: 200, html, bytes: html.length, ms: 3 };
    },
  };
}
