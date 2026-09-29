// Dedupe for imports and the Lead Finder (spec §6): place ID → domain → phone are certain;
// fuzzy name in the same town is only a *possible* duplicate for the merge screen.
// A match to a do-not-call firm (or the do-not-call list) always wins and can never be added.

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `http://${raw}`).hostname;
    if (!host.includes(".")) return null;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return us.length === 10 ? us : null;
}

const GENERIC_WORDS = new Set([
  "the",
  "llc",
  "inc",
  "co",
  "corp",
  "corporation",
  "company",
  "ltd",
  "group",
  "property",
  "properties",
  "management",
  "mgmt",
  "realty",
  "real",
  "estate",
  "residential",
  "rentals",
  "services",
  "and",
]);

export function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !GENERIC_WORDS.has(w))
    .join(" ");
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = new Array<boolean>(a.length).fill(false);
  const bMatch = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j += 1) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = bMatch[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export const FUZZY_NAME_THRESHOLD = 0.9;

export interface DedupeCandidate {
  placeId: string | null;
  normalizedDomain: string | null;
  normalizedPhone: string | null;
  normalizedName: string;
  city: string | null;
}

export interface ExistingFirm extends DedupeCandidate {
  id: string;
  dnc: boolean;
  dncSince?: Date | null;
}

export interface DncListEntry {
  kind: "place_id" | "domain" | "phone";
  value: string;
  reason: string;
  createdAt: Date;
}

export type DedupeMethod = "place_id" | "domain" | "phone" | "name_town";

export interface DedupeResult {
  status: "new" | "duplicate" | "possible_duplicate" | "dnc";
  companyId: string | null;
  method: DedupeMethod | null;
  reason: string | null;
}

const METHOD_LABEL: Record<DedupeMethod, string> = {
  place_id: "same Google place",
  domain: "same website",
  phone: "same phone",
  name_town: "similar name in the same town",
};

const dateLabel = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).format(d)
    : "earlier";

function certainMatch(c: DedupeCandidate, f: ExistingFirm): DedupeMethod | null {
  if (c.placeId && f.placeId && c.placeId === f.placeId) return "place_id";
  if (c.normalizedDomain && c.normalizedDomain === f.normalizedDomain) return "domain";
  if (c.normalizedPhone && c.normalizedPhone === f.normalizedPhone) return "phone";
  return null;
}

function fuzzyMatch(c: DedupeCandidate, f: ExistingFirm): boolean {
  if (!c.city || !f.city || c.city.toLowerCase() !== f.city.toLowerCase()) return false;
  return jaroWinkler(c.normalizedName, f.normalizedName) >= FUZZY_NAME_THRESHOLD;
}

export function findDuplicate(
  candidate: DedupeCandidate,
  existing: ExistingFirm[],
  dncList: DncListEntry[],
): DedupeResult {
  const listed = dncList.find(
    (e) =>
      (e.kind === "place_id" && e.value === candidate.placeId) ||
      (e.kind === "domain" && e.value === candidate.normalizedDomain) ||
      (e.kind === "phone" && e.value === candidate.normalizedPhone),
  );
  if (listed) {
    return {
      status: "dnc",
      companyId: null,
      method: listed.kind === "place_id" ? "place_id" : listed.kind,
      reason: `Do not call (since ${dateLabel(listed.createdAt)}): ${listed.reason}`,
    };
  }

  for (const firm of existing) {
    const method = certainMatch(candidate, firm);
    if (!method) continue;
    if (firm.dnc) {
      return {
        status: "dnc",
        companyId: firm.id,
        method,
        reason: `Do not call (since ${dateLabel(firm.dncSince)}), ${METHOD_LABEL[method]}`,
      };
    }
    return {
      status: "duplicate",
      companyId: firm.id,
      method,
      reason: `Already a lead: ${METHOD_LABEL[method]}`,
    };
  }

  for (const firm of existing) {
    if (!fuzzyMatch(candidate, firm)) continue;
    if (firm.dnc) {
      return {
        status: "dnc",
        companyId: firm.id,
        method: "name_town",
        reason: `Do not call (since ${dateLabel(firm.dncSince)}), ${METHOD_LABEL.name_town}`,
      };
    }
    return {
      status: "possible_duplicate",
      companyId: firm.id,
      method: "name_town",
      reason: `Possible duplicate: ${METHOD_LABEL.name_town}`,
    };
  }

  return { status: "new", companyId: null, method: null, reason: null };
}
