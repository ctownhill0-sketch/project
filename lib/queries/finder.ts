import { and, asc, desc, eq, gte, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  apiUsage,
  enrichmentEvidence,
  enrichmentRun,
  placeResult,
  review,
  savedSearch,
  searchRun,
  territory,
  territoryTown,
  triageDecision,
} from "@/lib/db/schema";
import { costAfterFree, PLACES_PRICING } from "@/lib/domain/finder-cost";
import { nyDateKey, nyDayStart, nyMonthStart } from "@/lib/domain/ny-time";
import { getFinderConfig, usageCounts } from "@/lib/finder/service";

type Evidence = typeof enrichmentEvidence.$inferSelect;

export type PlaceFilter = "all" | "pending" | "ready" | "added" | "duplicates" | "not_a_fit" | "dnc";

export interface PlaceRowView {
  id: string;
  placeId: string;
  name: string;
  town: string | null;
  state: string | null;
  websiteUri: string | null;
  fitStatus: "ok" | "excluded" | "not_a_fit";
  fitReason: string | null;
  dedupeStatus: "new" | "duplicate" | "possible_duplicate" | "dnc";
  dedupeReason: string | null;
  triageStatus: "pending" | "added" | "skipped" | "not_a_fit" | "dnc";
  enrichmentStatus: "none" | "queued" | "done" | "failed";
  score: number;
  why: string | null;
  software: string | null;
  softwareConfidence: string | null;
  units: number | null;
  listings: number | null;
  reviewFlagCount: number | null;
  companyId: string | null;
}

export const placeName = (p: {
  displayName: string | null;
  websiteName: string | null;
  normalizedDomain: string | null;
}) => p.displayName ?? p.websiteName ?? p.normalizedDomain ?? "Unnamed place";

function latestByKind(evidence: Evidence[]) {
  const map = new Map<string, Map<Evidence["kind"], Evidence>>();
  for (const e of evidence) {
    if (!e.placeResultId) continue;
    const inner = map.get(e.placeResultId) ?? new Map();
    inner.set(e.kind, e);
    map.set(e.placeResultId, inner);
  }
  return map;
}

const FILTERS: Record<PlaceFilter, ReturnType<typeof and> | undefined> = {
  all: undefined,
  pending: eq(placeResult.triageStatus, "pending"),
  ready: and(
    eq(placeResult.triageStatus, "pending"),
    eq(placeResult.fitStatus, "ok"),
    inArray(placeResult.dedupeStatus, ["new", "possible_duplicate"]),
  ),
  added: eq(placeResult.triageStatus, "added"),
  duplicates: inArray(placeResult.dedupeStatus, ["duplicate", "possible_duplicate"]),
  not_a_fit: or(ne(placeResult.fitStatus, "ok"), eq(placeResult.triageStatus, "not_a_fit")),
  dnc: or(eq(placeResult.dedupeStatus, "dnc"), eq(placeResult.triageStatus, "dnc")),
};

export async function listPlaces(
  db: Db,
  workspaceId: string,
  opts: { runId?: string | null; filter?: PlaceFilter; ids?: string[] },
): Promise<PlaceRowView[]> {
  const rows = await db
    .select()
    .from(placeResult)
    .where(
      and(
        eq(placeResult.workspaceId, workspaceId),
        opts.runId
          ? or(eq(placeResult.lastRunId, opts.runId), eq(placeResult.firstRunId, opts.runId))
          : undefined,
        opts.ids?.length ? inArray(placeResult.id, opts.ids) : undefined,
        FILTERS[opts.filter ?? "all"],
      ),
    )
    .orderBy(desc(placeResult.score), asc(placeResult.displayName));
  if (rows.length === 0) return [];
  const evidence = await db
    .select()
    .from(enrichmentEvidence)
    .where(
      inArray(
        enrichmentEvidence.placeResultId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(enrichmentEvidence.createdAt));
  const facts = latestByKind(evidence);
  return rows.map((p) => {
    const f = facts.get(p.id);
    const num = (kind: Evidence["kind"]) => (f?.get(kind) ? Number(f.get(kind)!.value) : null);
    return {
      id: p.id,
      placeId: p.placeId,
      name: placeName(p),
      town: p.town,
      state: p.state,
      websiteUri: p.websiteUri,
      fitStatus: p.fitStatus,
      fitReason: p.fitReason,
      dedupeStatus: p.dedupeStatus,
      dedupeReason: p.dedupeReason,
      triageStatus: p.triageStatus,
      enrichmentStatus: p.enrichmentStatus,
      score: p.score,
      why: p.why,
      software: f?.get("software")?.value ?? null,
      softwareConfidence: f?.get("software")?.confidence ?? null,
      units: num("size_units"),
      listings: num("listing_count"),
      reviewFlagCount: p.reviewFlagCount,
      companyId: p.companyId,
    };
  });
}

export async function placeCounts(db: Db, workspaceId: string, runId: string | null) {
  const counts = {} as Record<PlaceFilter, number>;
  for (const key of Object.keys(FILTERS) as PlaceFilter[]) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(placeResult)
      .where(
        and(
          eq(placeResult.workspaceId, workspaceId),
          runId ? or(eq(placeResult.lastRunId, runId), eq(placeResult.firstRunId, runId)) : undefined,
          FILTERS[key],
        ),
      );
    counts[key] = row?.n ?? 0;
  }
  return counts;
}

/** Pending places that can be decided on (not do-not-call, not already a lead), best first. */
export async function triageQueue(db: Db, workspaceId: string, runId: string | null) {
  const rows = await listPlaces(db, workspaceId, { runId, filter: "pending" });
  return rows.filter((r) => r.dedupeStatus !== "dnc" && r.dedupeStatus !== "duplicate");
}

export async function placeDetail(db: Db, workspaceId: string, id: string) {
  const [place] = await db
    .select()
    .from(placeResult)
    .where(and(eq(placeResult.id, id), eq(placeResult.workspaceId, workspaceId)));
  if (!place) return null;
  const [evidence, runs, reviews] = await Promise.all([
    db
      .select()
      .from(enrichmentEvidence)
      .where(eq(enrichmentEvidence.placeResultId, id))
      .orderBy(asc(enrichmentEvidence.createdAt)),
    db
      .select()
      .from(enrichmentRun)
      .where(eq(enrichmentRun.placeResultId, id))
      .orderBy(desc(enrichmentRun.createdAt)),
    db.select().from(review).where(eq(review.placeResultId, id)).orderBy(desc(review.publishedAt)),
  ]);
  const latest = new Map<Evidence["kind"], Evidence>();
  for (const e of evidence) latest.set(e.kind, e);
  return { place, name: placeName(place), evidence, latest, enrichmentRuns: runs, reviews };
}

export async function finderOverview(db: Db, workspaceId: string, now: Date) {
  const config = await getFinderConfig(db, workspaceId);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const [search, details, pending, added, runs, territories, towns, searches] = await Promise.all([
    usageCounts(db, workspaceId, "search", now),
    usageCounts(db, workspaceId, "details", now),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(placeResult)
      .where(
        and(
          eq(placeResult.workspaceId, workspaceId),
          eq(placeResult.triageStatus, "pending"),
          notInArray(placeResult.dedupeStatus, ["dnc", "duplicate"]),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(triageDecision)
      .where(
        and(
          eq(triageDecision.workspaceId, workspaceId),
          eq(triageDecision.decision, "add"),
          sql`${triageDecision.undoneAt} is null`,
          gte(triageDecision.createdAt, weekAgo),
        ),
      ),
    db
      .select()
      .from(searchRun)
      .where(eq(searchRun.workspaceId, workspaceId))
      .orderBy(desc(searchRun.createdAt))
      .limit(10),
    db.select().from(territory).where(eq(territory.workspaceId, workspaceId)).orderBy(asc(territory.name)),
    db
      .select()
      .from(territoryTown)
      .where(eq(territoryTown.workspaceId, workspaceId))
      .orderBy(asc(territoryTown.position)),
    db
      .select()
      .from(savedSearch)
      .where(eq(savedSearch.workspaceId, workspaceId))
      .orderBy(asc(savedSearch.name)),
  ]);
  return {
    caps: config.caps,
    keywords: config.keywords,
    usage: { search, details },
    pendingTriage: pending[0]?.n ?? 0,
    addedThisWeek: added[0]?.n ?? 0,
    runs,
    territories: territories.map((t) => ({ ...t, towns: towns.filter((tt) => tt.territoryId === t.id) })),
    savedSearches: searches,
  };
}

export async function usageReport(db: Db, workspaceId: string, now: Date) {
  const since = new Date(nyDayStart(now).getTime() - 29 * 24 * 3600 * 1000);
  const rows = await db
    .select()
    .from(apiUsage)
    .where(and(eq(apiUsage.workspaceId, workspaceId), gte(apiUsage.requestedAt, since)))
    .orderBy(desc(apiUsage.requestedAt));
  const counted = rows.filter((r) => r.outcome !== "blocked_cap");
  const byDay = new Map<string, { date: string; search: number; details: number; blocked: number }>();
  for (const r of rows) {
    const date = nyDateKey(r.requestedAt);
    const day = byDay.get(date) ?? { date, search: 0, details: 0, blocked: 0 };
    if (r.outcome === "blocked_cap") day.blocked += 1;
    else if (r.sku === "text_search_enterprise") day.search += 1;
    else if (r.sku === "place_details_atmosphere") day.details += 1;
    byDay.set(date, day);
  }
  const monthStart = nyMonthStart(now);
  const month = counted.filter((r) => r.requestedAt >= monthStart);
  const monthSearch = month.filter((r) => r.sku === "text_search_enterprise").length;
  const monthDetails = month.filter((r) => r.sku === "place_details_atmosphere").length;
  const byRun = new Map<string, number>();
  for (const r of counted) if (r.searchRunId) byRun.set(r.searchRunId, (byRun.get(r.searchRunId) ?? 0) + 1);
  const runRows = byRun.size
    ? await db
        .select()
        .from(searchRun)
        .where(inArray(searchRun.id, [...byRun.keys()]))
        .orderBy(desc(searchRun.createdAt))
    : [];
  return {
    days: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
    month: {
      search: monthSearch,
      details: monthDetails,
      costAfterFreeUsd:
        costAfterFree("text_search_enterprise", monthSearch, 0) +
        costAfterFree("place_details_atmosphere", monthDetails, 0),
    },
    listCostUsd:
      (monthSearch * PLACES_PRICING.text_search_enterprise.usdPer1000 +
        monthDetails * PLACES_PRICING.place_details_atmosphere.usdPer1000) /
      1000,
    runs: runRows.map((r) => ({
      runId: r.id,
      towns: r.towns,
      keywords: r.keywords,
      status: r.status,
      createdAt: r.createdAt,
      requests: byRun.get(r.id) ?? 0,
    })),
  };
}
