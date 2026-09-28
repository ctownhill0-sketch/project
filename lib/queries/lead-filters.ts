import { z } from "zod";
import type { LeadFilters } from "@/lib/queries/leads";

export const LEAD_STATUSES = ["new", "researching", "ready", "contacted", "excluded", "archived"] as const;
export const SOFTWARE_KINDS = [
  "appfolio",
  "buildium",
  "doorloop",
  "rent_manager",
  "yardi",
  "none",
  "unknown",
] as const;

const one = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" ? v : undefined), schema.optional()).catch(undefined);

const schema = z.object({
  status: one(z.enum(LEAD_STATUSES)),
  software: one(z.enum(SOFTWARE_KINDS)),
  q: one(z.string().trim().min(1).max(100)),
});

/** URL search params → lead filters. Anything invalid is ignored, never an error page. */
export function parseLeadFilters(params: Record<string, string | string[] | undefined>): LeadFilters {
  const parsed = schema.parse(params);
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as LeadFilters;
}

/** A /leads URL for these filters. With `forRecord`, ends in `lead=` so an id can be appended. */
export function leadsHref(
  filters: LeadFilters,
  patch: { [K in keyof LeadFilters]?: LeadFilters[K] | undefined } = {},
  forRecord = false,
): string {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const key of ["status", "software", "q"] as const) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  if (forRecord) return `/leads?${query ? `${query}&` : ""}lead=`;
  return query ? `/leads?${query}` : "/leads";
}
