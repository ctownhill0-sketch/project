// CSV import (brief M1): parse → map columns → validate → classify against existing leads and the
// do-not-call list. Pure: the wizard previews with this, and the commit re-runs it before writing.
import {
  findDuplicate,
  normalizeDomain,
  normalizeFirmName,
  normalizePhone,
  type DncListEntry,
  type ExistingFirm,
} from "@/lib/domain/dedupe";
import type { Software } from "@/lib/domain/scoring";

/** RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportField =
  "name" | "website" | "phone" | "city" | "state" | "units" | "listings" | "software" | "rentalsUrl";

export const IMPORT_FIELDS: { key: ImportField; label: string; hints: RegExp }[] = [
  {
    key: "name",
    label: "Firm name",
    hints: /^(company|firm|business)?\s*name$|^company$|^firm$|^business$/i,
  },
  { key: "website", label: "Website", hints: /website|web ?site|url|domain|site/i },
  { key: "phone", label: "Phone", hints: /phone|tel|telephone/i },
  { key: "city", label: "Town", hints: /^(city|town|locality)$/i },
  { key: "state", label: "State", hints: /^(state|st|region)$/i },
  { key: "units", label: "Units (estimated)", hints: /units|doors|homes under|portfolio size/i },
  { key: "listings", label: "Live listings (estimated)", hints: /listings|vacancies|available/i },
  { key: "software", label: "Software", hints: /software|portal|platform|pms/i },
  { key: "rentalsUrl", label: "Rentals page", hints: /rentals? (page|url)|listings? url/i },
];

export type ColumnMapping = Record<string, ImportField>;

/** Suggests a field for each header; unknown headers are left out (not imported). */
export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const h = header.trim();
    const field = IMPORT_FIELDS.find((f) => !used.has(f.key) && f.hints.test(h));
    if (field) {
      mapping[header] = field.key;
      used.add(field.key);
    }
  }
  return mapping;
}

const SOFTWARE_WORDS: [Software, RegExp][] = [
  ["appfolio", /appfolio/i],
  ["buildium", /buildium/i],
  ["doorloop", /doorloop/i],
  ["rent_manager", /rent ?manager/i],
  ["yardi", /yardi|rentcafe|breeze/i],
  ["propertyware", /propertyware/i],
  ["rentvine", /rentvine/i],
  ["tenantcloud", /tenantcloud/i],
  ["none", /^(none|no portal|n\/a)$/i],
];

export interface ImportRecord {
  name: string;
  domain: string | null;
  websiteUrl: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  city: string | null;
  state: string | null;
  units: number | null;
  listings: number | null;
  software: Software;
  rentalsUrl: string | null;
}

export interface MappedRow {
  /** 1-based line in the file (the header is line 1). */
  line: number;
  record: ImportRecord;
  errors: string[];
}

function wholeNumber(raw: string, label: string, errors: string[]): number | null {
  const v = raw.replace(/[,~+]/g, "").trim();
  if (!v) return null;
  if (!/^\d+$/.test(v)) {
    errors.push(`${label} isn't a whole number`);
    return null;
  }
  return Number(v);
}

export function mapRows(rows: string[][], mapping: ColumnMapping): MappedRow[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const index = new Map<ImportField, number>();
  header.forEach((h, i) => {
    const field = mapping[h];
    if (field && !index.has(field)) index.set(field, i);
  });
  const get = (row: string[], field: ImportField) => {
    const i = index.get(field);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };
  return body.map((row, n) => {
    const errors: string[] = [];
    const name = get(row, "name");
    if (!name) errors.push("Name is missing");
    const website = get(row, "website");
    const domain = normalizeDomain(website);
    if (website && !domain) errors.push("Website isn't a web address");
    const phone = get(row, "phone");
    const normalizedPhone = normalizePhone(phone);
    if (phone && !normalizedPhone) errors.push("Phone isn't a 10-digit US number");
    const state = get(row, "state").toUpperCase();
    if (state && !/^[A-Z]{2}$/.test(state)) errors.push("State should be 2 letters");
    const units = wholeNumber(get(row, "units"), "Units", errors);
    const listings = wholeNumber(get(row, "listings"), "Listings", errors);
    const softwareRaw = get(row, "software");
    const software = SOFTWARE_WORDS.find(([, re]) => re.test(softwareRaw))?.[0] ?? "unknown";
    const rentals = get(row, "rentalsUrl");
    return {
      line: n + 2,
      record: {
        name,
        domain,
        websiteUrl: domain
          ? /^https?:\/\//i.test(website)
            ? website
            : `https://${website.replace(/^\/+/, "")}`
          : null,
        phone: phone || null,
        normalizedPhone,
        city: get(row, "city") || null,
        state: state || null,
        units,
        listings,
        software,
        rentalsUrl: rentals && /^https?:\/\//i.test(rentals) ? rentals : null,
      },
      errors,
    };
  });
}

export interface ClassifiedRow extends MappedRow {
  status: "new" | "duplicate" | "possible_duplicate" | "dnc" | "error";
  reason: string | null;
  companyId: string | null;
}

/** Dedupe against existing leads, the do-not-call list and earlier rows of the same file. */
export function classifyRows(
  rows: MappedRow[],
  existing: ExistingFirm[],
  dncList: DncListEntry[],
): ClassifiedRow[] {
  const seen: (ExistingFirm & { line: number })[] = [];
  return rows.map((row) => {
    if (row.errors.length)
      return { ...row, status: "error" as const, reason: row.errors.join("; "), companyId: null };
    const candidate = {
      placeId: null,
      normalizedDomain: row.record.domain,
      normalizedPhone: row.record.normalizedPhone,
      normalizedName: normalizeFirmName(row.record.name),
      city: row.record.city,
    };
    const hit = findDuplicate(candidate, existing, dncList);
    if (hit.status !== "new") {
      seen.push({ ...candidate, id: `row-${row.line}`, dnc: false, line: row.line });
      return { ...row, status: hit.status, reason: hit.reason, companyId: hit.companyId };
    }
    const repeat = findDuplicate(candidate, seen, []);
    seen.push({ ...candidate, id: `row-${row.line}`, dnc: false, line: row.line });
    if (repeat.status === "duplicate" || repeat.status === "possible_duplicate") {
      const line = seen.find((s) => s.id === repeat.companyId)?.line;
      // A certain match (same website or phone) is skipped; a similar name is imported and shown on
      // the merge screen, like a fuzzy match against an existing lead.
      return repeat.status === "duplicate"
        ? {
            ...row,
            status: "duplicate" as const,
            reason: `Same firm as an earlier row (line ${line})`,
            companyId: null,
          }
        : {
            ...row,
            status: "possible_duplicate" as const,
            reason: `Similar name to an earlier row (line ${line})`,
            companyId: null,
          };
    }
    return { ...row, status: "new" as const, reason: null, companyId: null };
  });
}
