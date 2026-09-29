// Lead Finder service (spec §2–§8): runs, ingest (fit + dedupe + score), enrichment, reviews,
// triage with undo, and the Google-content purge. Every business change goes through withAudit.
// Nothing runs in the background: the browser calls one step at a time (D-F6).
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { withAudit, writeAudit, type AuditContext, type Tx } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import {
  apiUsage,
  call,
  company,
  deal,
  mysteryShop,
  detectionRun,
  dncEntry,
  enrichmentEvidence,
  enrichmentRun,
  exclusionRule,
  placeResult,
  review,
  scoreHistory,
  searchQuery,
  searchRun,
  softwarePattern,
  territoryTown,
  triageDecision,
  type FieldSources,
  type FetchedPage,
  type TownRef,
} from "@/lib/db/schema";
import {
  findDuplicate,
  normalizeDomain,
  normalizeFirmName,
  normalizePhone,
  type ExistingFirm,
} from "@/lib/domain/dedupe";
import {
  countListings,
  detectSoftware,
  extractContacts,
  extractName,
  extractServiceTypes,
  extractSize,
  likelyPages,
  parsePage,
  type ParsedPage,
} from "@/lib/domain/enrich";
import { classifyFit } from "@/lib/domain/exclusion";
import { capCheck, DEFAULT_CAPS, estimateRun, type Caps, type PlacesSku } from "@/lib/domain/finder-cost";
import { nyDayStart, nyMonthStart } from "@/lib/domain/ny-time";
import { flagReview } from "@/lib/domain/review-flags";
import {
  DEFAULT_WEIGHTS,
  scoreLead,
  whyThisLead,
  type LeadFacts,
  type ScoringWeights,
  type Software,
} from "@/lib/domain/scoring";
import type { FetchResult } from "@/lib/fetcher/fetcher";
import type { FoundPlace, PlacesClient, UsageHooks } from "@/lib/finder/places";
import { leadFacts } from "@/lib/queries/facts";
import { getSetting } from "@/lib/queries/settings";

export type Ctx = AuditContext;
type PlaceRow = typeof placeResult.$inferSelect;
type Evidence = typeof enrichmentEvidence.$inferSelect;

export interface PageSource {
  get(url: string): Promise<FetchResult>;
}

export const DEFAULT_KEYWORDS = [
  "property management",
  "property manager",
  "rental management",
  "apartment management",
  "real estate management",
];

export interface FinderConfig {
  caps: { search: Caps; details: Caps };
  keywords: string[];
  cacheDays: number;
  reviewTopN: number;
  weights: ScoringWeights;
}

export async function getFinderConfig(db: Db | Tx, workspaceId: string): Promise<FinderConfig> {
  const d = db as Db;
  const [caps, keywords, cacheDays, reviewTopN, weights] = await Promise.all([
    getSetting(d, workspaceId, "finder.caps", DEFAULT_CAPS),
    getSetting(d, workspaceId, "finder.keywords", DEFAULT_KEYWORDS),
    getSetting(d, workspaceId, "finder.googleCacheDays", 30),
    getSetting(d, workspaceId, "finder.reviewTopN", 10),
    getSetting(d, workspaceId, "scoringWeights", DEFAULT_WEIGHTS),
  ]);
  return {
    caps: {
      search: { ...DEFAULT_CAPS.search, ...caps.search },
      details: { ...DEFAULT_CAPS.details, ...caps.details },
    },
    keywords,
    cacheDays,
    reviewTopN,
    weights: { ...DEFAULT_WEIGHTS, ...weights },
  };
}

const SKU_GROUP: Record<"search" | "details", PlacesSku> = {
  search: "text_search_enterprise",
  details: "place_details_atmosphere",
};

/** Requests sent (or failed at Google) today and this month, in New York time. Blocked ones don't count. */
export async function usageCounts(db: Db | Tx, workspaceId: string, group: "search" | "details", now: Date) {
  const since = (from: Date) =>
    (db as Db)
      .select({ n: sql<number>`count(*)::int` })
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.workspaceId, workspaceId),
          eq(apiUsage.sku, SKU_GROUP[group]),
          inArray(apiUsage.outcome, ["sent", "failed"]),
          sql`${apiUsage.requestedAt} >= ${from.toISOString()}`,
        ),
      );
  const [[today], [month]] = await Promise.all([since(nyDayStart(now)), since(nyMonthStart(now))]);
  return { today: today?.n ?? 0, month: month?.n ?? 0 };
}

/**
 * Cap guard + usage log for one kind of request. The usage log is itself a log (like audit_log),
 * so its rows aren't audited separately (D-F9).
 */
function usageHooks(
  db: Db,
  ctx: Ctx,
  group: "search" | "details",
  caps: Caps,
  link: { searchRunId?: string | null; companyId?: string | null },
  now: Date,
  counter?: { sent: number },
): UsageHooks {
  return {
    guard: async () => capCheck(await usageCounts(db, ctx.workspaceId, group, now), caps),
    record: async (outcome, httpStatus) => {
      if (outcome !== "blocked_cap" && counter) counter.sent += 1;
      await db.insert(apiUsage).values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        sku: SKU_GROUP[group],
        outcome,
        httpStatus,
        searchRunId: link.searchRunId ?? null,
        companyId: link.companyId ?? null,
        requestedAt: now,
      });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Runs

export interface RunInput {
  towns: TownRef[];
  keywords: string[];
  territoryId?: string | null;
  savedSearchId?: string | null;
}

export async function createSearchRun(db: Db, ctx: Ctx, input: RunInput, now: Date) {
  const towns = input.towns
    .map((t) => ({ town: t.town.trim(), state: t.state.trim().toUpperCase() }))
    .filter((t) => t.town && t.state);
  const keywords = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))];
  if (towns.length === 0) throw new Error("Add at least one town.");
  if (keywords.length === 0) throw new Error("Add at least one keyword.");
  const used = await usageCounts(db, ctx.workspaceId, "search", now);
  const estimate = estimateRun({ towns: towns.length, keywords: keywords.length, usedThisMonth: used.month });
  return withAudit(db, ctx, { action: "create", entity: "search_run" }, async (tx) => {
    const [run] = await tx
      .insert(searchRun)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        towns,
        keywords,
        territoryId: input.territoryId ?? null,
        savedSearchId: input.savedSearchId ?? null,
        plannedQueries: estimate.queries,
        estimatedRequests: estimate.maxRequests,
        estimatedCostUsd: estimate.costAfterFreeUsd.toFixed(2),
      })
      .returning();
    if (!run) throw new Error("Could not create the search run.");
    let position = 0;
    await tx.insert(searchQuery).values(
      towns.flatMap((t) =>
        keywords.map((keyword) => ({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          searchRunId: run.id,
          town: t.town,
          state: t.state,
          keyword,
          position: position++,
        })),
      ),
    );
    return { result: run, entityId: run.id, after: { towns, keywords, estimate } };
  });
}

async function loadRules(db: Db | Tx, workspaceId: string) {
  return (db as Db).select().from(exclusionRule).where(eq(exclusionRule.workspaceId, workspaceId));
}

async function loadExisting(db: Db | Tx, workspaceId: string): Promise<ExistingFirm[]> {
  const rows = await (db as Db)
    .select()
    .from(company)
    .where(and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId)));
  return rows.map((c) => ({
    id: c.id,
    placeId: c.googlePlaceId,
    normalizedDomain: c.normalizedDomain,
    normalizedPhone: c.normalizedPhone,
    normalizedName: normalizeFirmName(c.name),
    city: c.city,
    dnc: c.dncFlag,
    dncSince: c.updatedAt,
  }));
}

async function loadDncList(db: Db | Tx, workspaceId: string) {
  const rows = await (db as Db).select().from(dncEntry).where(eq(dncEntry.workspaceId, workspaceId));
  return rows.map((r) => ({ kind: r.kind, value: r.value, reason: r.reason, createdAt: r.createdAt }));
}

/** The scoring facts for a place: what enrichment found plus what we know about fit and reviews. */
export function placeFacts(place: PlaceRow, evidence: Evidence[]): LeadFacts {
  const latest = (kind: Evidence["kind"]) => evidence.filter((e) => e.kind === kind).at(-1);
  const units = latest("size_units");
  const listings = latest("listing_count");
  return {
    software: ((latest("software")?.value as Software | undefined) ?? "unknown") as Software,
    units: units ? Number(units.value) : null,
    liveListings: listings ? Number(listings.value) : null,
    isLocal: true, // the founder searched this town on purpose
    shop: null,
    reviewFlags: place.reviewFlagCount ?? 0,
    fit: { status: place.fitStatus, reason: place.fitReason },
  };
}

function scored(facts: LeadFacts, weights: ScoringWeights) {
  const r = scoreLead(facts, weights);
  return { score: r.score, scoreBreakdown: r.breakdown, why: whyThisLead(facts) };
}

async function ingestPlace(
  tx: Tx,
  ctx: Ctx,
  runId: string,
  found: FoundPlace,
  rules: Awaited<ReturnType<typeof loadRules>>,
  existing: ExistingFirm[],
  dncList: Awaited<ReturnType<typeof loadDncList>>,
  config: FinderConfig,
  now: Date,
): Promise<{ isNew: boolean }> {
  const normalizedDomain = normalizeDomain(found.websiteUri);
  const normalizedPhone = normalizePhone(found.nationalPhone);
  const [prior] = await tx
    .select()
    .from(placeResult)
    .where(and(eq(placeResult.workspaceId, ctx.workspaceId), eq(placeResult.placeId, found.placeId)));
  const fit = prior?.fitOverridden
    ? { status: prior.fitStatus, reason: prior.fitReason, ruleId: prior.fitRuleId }
    : classifyFit({ name: found.name, domain: normalizedDomain, types: found.types }, rules);
  const dedupe = findDuplicate(
    {
      placeId: found.placeId,
      normalizedDomain,
      normalizedPhone,
      normalizedName: normalizeFirmName(found.name),
      city: found.town,
    },
    // A place already added from this search is its own company: don't call it a duplicate of itself.
    existing.filter((f) => f.id !== prior?.companyId),
    dncList,
  );
  const google = {
    displayName: found.name,
    formattedAddress: found.formattedAddress,
    types: found.types,
    businessStatus: found.businessStatus,
    websiteUri: found.websiteUri,
    nationalPhone: found.nationalPhone,
    userRatingCount: found.userRatingCount,
    googleMapsUri: found.googleMapsUri,
    googleFetchedAt: now,
    googleExpiresAt: new Date(now.getTime() + config.cacheDays * 24 * 3600 * 1000),
  };
  const derived = {
    town: found.town,
    state: found.state,
    normalizedDomain,
    normalizedPhone,
    fitStatus: fit.status,
    fitReason: fit.reason,
    fitRuleId: fit.ruleId,
    dedupeStatus: prior?.triageStatus === "added" ? prior.dedupeStatus : dedupe.status,
    dedupeCompanyId: prior?.triageStatus === "added" ? prior.dedupeCompanyId : dedupe.companyId,
    dedupeReason: prior?.triageStatus === "added" ? prior.dedupeReason : dedupe.reason,
    lastRunId: runId,
  };
  if (prior) {
    const evidence = await tx
      .select()
      .from(enrichmentEvidence)
      .where(eq(enrichmentEvidence.placeResultId, prior.id));
    const next = { ...prior, ...google, ...derived };
    await tx
      .update(placeResult)
      .set({ ...google, ...derived, ...scored(placeFacts(next, evidence), config.weights) })
      .where(eq(placeResult.id, prior.id));
    return { isNew: false };
  }
  const draft = { ...google, ...derived, reviewFlagCount: 0 } as PlaceRow;
  await tx.insert(placeResult).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    placeId: found.placeId,
    firstRunId: runId,
    ...google,
    ...derived,
    ...scored(placeFacts(draft, []), config.weights),
  });
  return { isNew: true };
}

export interface StepResult {
  done: boolean;
  run: typeof searchRun.$inferSelect;
  message: string | null;
  query: { town: string; state: string; keyword: string; found: number; newFound: number } | null;
}

const FATAL = new Set(["missing_key", "invalid_key", "quota_exceeded"]);

/** Runs the next pending query of a run (one Places search, all pages). The browser calls this in a loop. */
export async function runNextQuery(
  db: Db,
  ctx: Ctx,
  runId: string,
  client: PlacesClient,
  now: Date,
): Promise<StepResult> {
  const load = async () => {
    const [row] = await db
      .select()
      .from(searchRun)
      .where(and(eq(searchRun.id, runId), eq(searchRun.workspaceId, ctx.workspaceId)));
    if (!row) throw new Error("Search run not found.");
    return row;
  };
  const run = await load();
  if (run.status !== "planned" && run.status !== "running")
    return { done: true, run, message: run.error, query: null };

  const [next] = await db
    .select()
    .from(searchQuery)
    .where(and(eq(searchQuery.searchRunId, runId), eq(searchQuery.status, "pending")))
    .orderBy(asc(searchQuery.position))
    .limit(1);
  if (!next) {
    await db.update(searchRun).set({ status: "done", finishedAt: now }).where(eq(searchRun.id, runId));
    return { done: true, run: await load(), message: null, query: null };
  }

  const config = await getFinderConfig(db, ctx.workspaceId);
  const counter = { sent: 0 };
  const hooks = usageHooks(db, ctx, "search", config.caps.search, { searchRunId: runId }, now, counter);
  const res = await client.searchAll({ keyword: next.keyword, town: next.town, state: next.state }, hooks);

  let newFound = 0;
  await withAudit(db, ctx, { action: "update", entity: "search_run" }, async (tx) => {
    const [rules, existing, dncList] = await Promise.all([
      loadRules(tx, ctx.workspaceId),
      loadExisting(tx, ctx.workspaceId),
      loadDncList(tx, ctx.workspaceId),
    ]);
    for (const found of res.places) {
      const { isNew } = await ingestPlace(tx, ctx, runId, found, rules, existing, dncList, config, now);
      if (isNew) newFound += 1;
    }
    const capped = res.outcome === "cap_reached";
    const failed = !capped && !["ok", "empty"].includes(res.outcome);
    await tx
      .update(searchQuery)
      .set({
        status: capped ? (res.pages > 0 ? "done" : "skipped_cap") : failed ? "failed" : "done",
        pages: res.pages,
        resultCount: res.places.length,
        error: failed || capped ? res.message : null,
      })
      .where(eq(searchQuery.id, next.id));
    if (capped) {
      await tx
        .update(searchQuery)
        .set({ status: "skipped_cap" })
        .where(and(eq(searchQuery.searchRunId, runId), eq(searchQuery.status, "pending")));
    }
    const stopped = capped || FATAL.has(res.outcome);
    await tx
      .update(searchRun)
      .set({
        status: capped ? "stopped_cap" : FATAL.has(res.outcome) ? "failed" : "running",
        error: stopped ? res.message : null,
        finishedAt: stopped ? now : null,
        requestsUsed: sql`${searchRun.requestsUsed} + ${counter.sent}`,
        resultsFound: sql`${searchRun.resultsFound} + ${res.places.length}`,
        newFound: sql`${searchRun.newFound} + ${newFound}`,
      })
      .where(eq(searchRun.id, runId));
    if (run.territoryId) {
      await tx
        .update(territoryTown)
        .set({ lastSearchedAt: now, resultsFound: sql`${territoryTown.resultsFound} + ${res.places.length}` })
        .where(
          and(
            eq(territoryTown.territoryId, run.territoryId),
            eq(territoryTown.town, next.town),
            eq(territoryTown.state, next.state),
          ),
        );
    }
    return {
      result: null,
      entityId: runId,
      after: { query: next.position, outcome: res.outcome, found: res.places.length, newFound },
    };
  });

  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(searchQuery)
    .where(and(eq(searchQuery.searchRunId, runId), eq(searchQuery.status, "pending")));
  let after = await load();
  if (after.status === "running" && (pending?.n ?? 0) === 0) {
    await db.update(searchRun).set({ status: "done", finishedAt: now }).where(eq(searchRun.id, runId));
    after = await load();
  }
  return {
    done: after.status !== "running",
    run: after,
    message: after.error ?? (res.outcome === "ok" || res.outcome === "empty" ? null : res.message),
    query: { town: next.town, state: next.state, keyword: next.keyword, found: res.places.length, newFound },
  };
}

export async function stopRun(db: Db, ctx: Ctx, runId: string, now: Date) {
  return withAudit(db, ctx, { action: "update", entity: "search_run" }, async (tx) => {
    await tx
      .update(searchRun)
      .set({ status: "stopped", finishedAt: now })
      .where(
        and(
          eq(searchRun.id, runId),
          eq(searchRun.workspaceId, ctx.workspaceId),
          inArray(searchRun.status, ["planned", "running"]),
        ),
      );
    return { result: null, entityId: runId, after: { status: "stopped" } };
  });
}

// ---------------------------------------------------------------------------------------------
// Enrichment

async function fetchSite(source: PageSource, home: string) {
  const log: FetchedPage[] = [];
  const pages: ParsedPage[] = [];
  const first = await source.get(home);
  log.push({
    url: first.url,
    status: first.status,
    bytes: first.bytes,
    ms: first.ms,
    ...(first.ok ? {} : { skipped: first.reason }),
  });
  if (!first.ok) return { log, pages, failure: first.reason };
  const homePage = parsePage(first.url, first.html);
  pages.push(homePage);
  for (const url of likelyPages(homePage)) {
    const res = await source.get(url);
    log.push({
      url: res.url,
      status: res.status,
      bytes: res.bytes,
      ms: res.ms,
      ...(res.ok ? {} : { skipped: res.reason }),
    });
    if (res.ok) pages.push(parsePage(res.url, res.html));
  }
  return { log, pages, failure: null };
}

type EvidenceDraft = {
  kind: Evidence["kind"];
  value: string;
  confidence: "high" | "medium" | "low";
  sourceUrl: string;
  quote: string | null;
};

function evidenceFrom(
  pages: ParsedPage[],
  patterns: { software: Software; pattern: string; kind: "domain" | "substring" }[],
): EvidenceDraft[] {
  const out: EvidenceDraft[] = [];
  const sw = detectSoftware(pages, patterns);
  if (sw.sourceUrl)
    out.push({
      kind: "software",
      value: sw.software,
      confidence: sw.confidence,
      sourceUrl: sw.sourceUrl,
      quote: sw.evidence,
    });
  const size = extractSize(pages);
  if (size)
    out.push({
      kind: "size_units",
      value: String(size.value),
      confidence: "medium",
      sourceUrl: size.sourceUrl,
      quote: size.quote,
    });
  const listing = pages.slice(1).map(countListings).find(Boolean) ?? countListings(pages[0]!);
  if (listing)
    out.push({
      kind: "listing_count",
      value: String(listing.value),
      confidence: "medium",
      sourceUrl: listing.sourceUrl,
      quote: listing.quote,
    });
  const contacts = extractContacts(pages);
  for (const p of contacts.phones.slice(0, 2))
    out.push({ kind: "phone", value: p.value, confidence: "high", sourceUrl: p.sourceUrl, quote: p.quote });
  for (const e of contacts.emails.slice(0, 2))
    out.push({ kind: "email", value: e.value, confidence: "high", sourceUrl: e.sourceUrl, quote: e.quote });
  const name = extractName(pages[0]!);
  if (name)
    out.push({ kind: "name", value: name, confidence: "medium", sourceUrl: pages[0]!.url, quote: name });
  for (const t of extractServiceTypes(pages))
    out.push({
      kind: "service_type",
      value: t.value,
      confidence: "medium",
      sourceUrl: t.sourceUrl,
      quote: t.quote,
    });
  return out;
}

/** Enriches up to `limit` pending places of a run from their websites (4 hosts at a time). */
export async function enrichPending(
  db: Db,
  ctx: Ctx,
  runId: string | null,
  source: PageSource,
  opts: { limit?: number; only?: string[] },
  now: Date,
): Promise<{ processed: number; remaining: number }> {
  const limit = opts.limit ?? 5;
  const where = and(
    eq(placeResult.workspaceId, ctx.workspaceId),
    runId ? or(eq(placeResult.lastRunId, runId), eq(placeResult.firstRunId, runId)) : undefined,
    opts.only?.length ? inArray(placeResult.id, opts.only) : undefined,
    inArray(placeResult.enrichmentStatus, ["none", "queued"]),
    sql`${placeResult.websiteUri} is not null`,
    eq(placeResult.fitStatus, "ok"),
    inArray(placeResult.dedupeStatus, ["new", "possible_duplicate"]),
    inArray(placeResult.triageStatus, ["pending", "added"]),
  );
  const batch = await db
    .select()
    .from(placeResult)
    .where(where)
    .orderBy(desc(placeResult.userRatingCount))
    .limit(limit);
  const patterns = (
    await db
      .select()
      .from(softwarePattern)
      .where(and(eq(softwarePattern.workspaceId, ctx.workspaceId), eq(softwarePattern.isActive, true)))
  ).map((p) => ({ software: p.software as Software, pattern: p.pattern, kind: p.kind }));
  const config = await getFinderConfig(db, ctx.workspaceId);

  const one = async (place: PlaceRow) => {
    const site = await fetchSite(source, place.websiteUri!);
    const drafts = site.failure ? [] : evidenceFrom(site.pages, patterns);
    await withAudit(db, ctx, { action: "create", entity: "enrichment_run" }, async (tx) => {
      const [run] = await tx
        .insert(enrichmentRun)
        .values({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          placeResultId: place.id,
          companyId: place.companyId,
          url: place.websiteUri!,
          status: site.failure === "robots" ? "blocked_robots" : site.failure ? "failed" : "done",
          pages: site.log,
          error: site.failure,
          finishedAt: now,
        })
        .returning();
      if (drafts.length) {
        await tx.insert(enrichmentEvidence).values(
          drafts.map((d) => ({
            ...d,
            workspaceId: ctx.workspaceId,
            createdById: ctx.userId,
            enrichmentRunId: run!.id,
            placeResultId: place.id,
            companyId: place.companyId,
          })),
        );
      }
      const evidence = await tx
        .select()
        .from(enrichmentEvidence)
        .where(eq(enrichmentEvidence.placeResultId, place.id))
        .orderBy(asc(enrichmentEvidence.createdAt));
      const websiteName = drafts.find((d) => d.kind === "name")?.value ?? place.websiteName;
      const next = { ...place, websiteName };
      await tx
        .update(placeResult)
        .set({
          enrichmentStatus: site.failure ? "failed" : "done",
          websiteName,
          ...scored(placeFacts(next, evidence), config.weights),
        })
        .where(eq(placeResult.id, place.id));
      return {
        result: null,
        entityId: run!.id,
        after: { place: place.id, status: run!.status, evidence: drafts.length },
      };
    });
  };

  for (let i = 0; i < batch.length; i += 4) await Promise.all(batch.slice(i, i + 4).map(one));

  const [left] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(placeResult)
    .where(and(where));
  return { processed: batch.length, remaining: left?.n ?? 0 };
}

// ---------------------------------------------------------------------------------------------
// Reviews (on demand; Place Details Enterprise + Atmosphere)

export async function fetchPlaceReviews(
  db: Db,
  ctx: Ctx,
  placeResultId: string,
  client: PlacesClient,
  now: Date,
) {
  const [place] = await db
    .select()
    .from(placeResult)
    .where(and(eq(placeResult.id, placeResultId), eq(placeResult.workspaceId, ctx.workspaceId)));
  if (!place) throw new Error("Place not found.");
  const config = await getFinderConfig(db, ctx.workspaceId);
  const hooks = usageHooks(db, ctx, "details", config.caps.details, { companyId: place.companyId }, now);
  const res = await client.reviews(place.placeId, hooks);
  if (res.outcome !== "ok" && res.outcome !== "empty")
    return { outcome: res.outcome, flags: 0, message: res.message };
  const expiresAt = new Date(now.getTime() + config.cacheDays * 24 * 3600 * 1000);
  const flags = res.reviews.filter((r) => flagReview(r.text)).length;
  await withAudit(db, ctx, { action: "update", entity: "place_result" }, async (tx) => {
    await tx.delete(review).where(eq(review.placeResultId, place.id));
    if (res.reviews.length) {
      await tx.insert(review).values(
        res.reviews.map((r) => ({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          placeResultId: place.id,
          companyId: place.companyId,
          source: "google_places",
          rating: r.rating,
          text: r.text,
          publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
          attribution: "Google Maps",
          authorName: r.authorName,
          authorUri: r.authorUri,
          expiresAt,
        })),
      );
    }
    const evidence = await tx
      .select()
      .from(enrichmentEvidence)
      .where(eq(enrichmentEvidence.placeResultId, place.id))
      .orderBy(asc(enrichmentEvidence.createdAt));
    const next = { ...place, reviewFlagCount: flags };
    await tx
      .update(placeResult)
      .set({ reviewFlagCount: flags, ...scored(placeFacts(next, evidence), config.weights) })
      .where(eq(placeResult.id, place.id));
    if (place.companyId) {
      await tx.update(company).set({ reviewFlagCount: flags }).where(eq(company.id, place.companyId));
      await rescoreCompany(tx, ctx, place.companyId, config.weights, "Review flags updated", now);
    }
    return { result: null, entityId: place.id, after: { reviews: res.reviews.length, flags } };
  });
  return { outcome: res.outcome, flags, message: res.message };
}

/** Recompute a lead's score from its row and shops; writes score_history when it changes. */
export async function rescoreCompany(
  tx: Tx,
  ctx: Ctx,
  companyId: string,
  weights: ScoringWeights,
  reason: string,
  now: Date,
) {
  const [firm] = await tx.select().from(company).where(eq(company.id, companyId));
  if (!firm) return;
  const shops = await tx
    .select({ sentAt: mysteryShop.sentAt, firstReplyAt: mysteryShop.firstReplyAt })
    .from(mysteryShop)
    .where(eq(mysteryShop.companyId, companyId));
  const result = scoreLead(leadFacts(firm, shops, now), weights);
  if (result.score === firm.score && JSON.stringify(result.breakdown) === JSON.stringify(firm.scoreBreakdown))
    return;
  await tx
    .update(company)
    .set({ score: result.score, scoreBreakdown: result.breakdown })
    .where(eq(company.id, companyId));
  await tx.insert(scoreHistory).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    companyId,
    score: result.score,
    breakdown: result.breakdown,
    reason,
  });
}

// ---------------------------------------------------------------------------------------------
// Triage

export type TriageKind = "add" | "skip" | "not_a_fit" | "dnc";

function addDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 3600 * 1000);
}

export async function triagePlace(
  db: Db,
  ctx: Ctx,
  placeResultId: string,
  decision: TriageKind,
  now: Date,
): Promise<{ companyId: string | null }> {
  const config = await getFinderConfig(db, ctx.workspaceId);
  return withAudit(db, ctx, { action: "update", entity: "place_result" }, async (tx) => {
    const [place] = await tx
      .select()
      .from(placeResult)
      .where(and(eq(placeResult.id, placeResultId), eq(placeResult.workspaceId, ctx.workspaceId)));
    if (!place) throw new Error("Place not found.");
    if (place.triageStatus !== "pending")
      throw new Error("This place was already triaged. Undo first to change it.");
    let companyId: string | null = null;

    if (decision === "add") {
      // Re-check against today's leads and do-not-call list, not just what the search saw.
      const [existing, dncList] = await Promise.all([
        loadExisting(tx, ctx.workspaceId),
        loadDncList(tx, ctx.workspaceId),
      ]);
      const check = findDuplicate(
        {
          placeId: place.placeId,
          normalizedDomain: place.normalizedDomain,
          normalizedPhone: place.normalizedPhone,
          normalizedName: normalizeFirmName(place.displayName ?? place.websiteName ?? ""),
          city: place.town,
        },
        existing,
        dncList,
      );
      if (place.dedupeStatus === "dnc" || check.status === "dnc") {
        throw new Error("This firm is on the do-not-call list and can't be added.");
      }
      if (check.status === "duplicate") throw new Error(`Already a lead (${check.reason ?? "duplicate"}).`);
      companyId = await createCompanyFromPlace(tx, ctx, place, config, now);
    } else if (decision === "dnc") {
      const entries = [
        { kind: "place_id" as const, value: place.placeId },
        ...(place.normalizedDomain ? [{ kind: "domain" as const, value: place.normalizedDomain }] : []),
        ...(place.normalizedPhone ? [{ kind: "phone" as const, value: place.normalizedPhone }] : []),
      ];
      await tx
        .insert(dncEntry)
        .values(
          entries.map((e) => ({
            ...e,
            workspaceId: ctx.workspaceId,
            createdById: ctx.userId,
            reason: "Marked do not call in triage",
          })),
        )
        .onConflictDoNothing();
      if (place.dedupeCompanyId)
        await tx.update(company).set({ dncFlag: true }).where(eq(company.id, place.dedupeCompanyId));
    }

    const status = decision === "add" ? "added" : decision === "skip" ? "skipped" : decision;
    await tx.update(placeResult).set({ triageStatus: status, companyId }).where(eq(placeResult.id, place.id));
    await tx.insert(triageDecision).values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      placeResultId: place.id,
      decision,
      previousStatus: place.triageStatus,
      companyId,
    });
    return {
      result: { companyId },
      entityId: place.id,
      before: { triageStatus: place.triageStatus },
      after: { triageStatus: status, companyId },
    };
  });
}

async function createCompanyFromPlace(
  tx: Tx,
  ctx: Ctx,
  place: PlaceRow,
  config: FinderConfig,
  now: Date,
): Promise<string> {
  const evidence = await tx
    .select()
    .from(enrichmentEvidence)
    .where(eq(enrichmentEvidence.placeResultId, place.id))
    .orderBy(asc(enrichmentEvidence.createdAt));
  const facts = placeFacts(place, evidence);
  const latest = (kind: Evidence["kind"]) => evidence.filter((e) => e.kind === kind).at(-1);
  const software = latest("software");
  const units = latest("size_units");
  const listings = latest("listing_count");
  const sitePhone = latest("phone")?.value ?? null;
  const siteEnriched = place.enrichmentStatus === "done";
  const name = place.displayName ?? place.websiteName ?? place.normalizedDomain ?? "Unnamed firm";
  const phone = place.nationalPhone ?? sitePhone;
  const fieldSources: FieldSources = {
    name: place.displayName ? "google" : "website",
    ...(phone ? { phone: place.nationalPhone ? "google" : "website" } : {}),
    ...(place.websiteUri ? { websiteUrl: "google" } : {}),
    ...(place.formattedAddress ? { address: "google" } : {}),
  };
  const result = scoreLead(facts, config.weights);
  const [firm] = await tx
    .insert(company)
    .values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name,
      normalizedName: normalizeFirmName(name) || name.toLowerCase(),
      domain: place.normalizedDomain,
      normalizedDomain: place.normalizedDomain,
      websiteUrl: place.websiteUri,
      phone,
      normalizedPhone: normalizePhone(phone),
      city: place.town,
      state: place.state,
      isLocal: true,
      address: place.formattedAddress,
      googlePlaceId: place.placeId,
      googleExpiresAt: place.googleExpiresAt ?? addDays(now, config.cacheDays),
      source: "finder",
      fieldSources,
      detectedSoftware: facts.software,
      softwareEvidence: software?.quote ?? null,
      softwareConfidence: software?.confidence ?? null,
      needsSoftwareReview: software ? software.confidence === "low" : siteEnriched,
      estUnits: units ? Number(units.value) : null,
      estUnitsSource: units ? "website" : "unknown",
      sizeQuote: units?.quote ?? null,
      liveListingsCount: listings ? Number(listings.value) : null,
      liveListingsSource: listings ? "website" : "unknown",
      availableRentalsUrl: listings?.sourceUrl ?? null,
      businessEmail: latest("email")?.value ?? null,
      serviceTypes: [...new Set(evidence.filter((e) => e.kind === "service_type").map((e) => e.value))],
      reviewFlagCount: place.reviewFlagCount ?? 0,
      fitStatus: place.fitStatus,
      fitReason: place.fitReason,
      score: result.score,
      scoreBreakdown: result.breakdown,
      status: "new",
    })
    .returning();
  if (!firm) throw new Error("Could not create the lead.");
  await tx
    .update(enrichmentEvidence)
    .set({ companyId: firm.id })
    .where(eq(enrichmentEvidence.placeResultId, place.id));
  await tx.update(enrichmentRun).set({ companyId: firm.id }).where(eq(enrichmentRun.placeResultId, place.id));
  await tx.update(review).set({ companyId: firm.id }).where(eq(review.placeResultId, place.id));
  if (software) {
    await tx.insert(detectionRun).values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      companyId: firm.id,
      method: "auto",
      software: software.value as Software,
      evidence: software.quote,
      confidence:
        software.confidence === "high" ? "0.90" : software.confidence === "medium" ? "0.60" : "0.30",
    });
  }
  await tx.insert(scoreHistory).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    companyId: firm.id,
    score: result.score,
    breakdown: result.breakdown,
    reason: "Added from the lead finder",
  });
  await bumpTerritory(tx, place, 1);
  await writeAudit(
    tx,
    ctx,
    { action: "create", entity: "company" },
    { entityId: firm.id, after: { name, source: "finder", placeId: place.placeId } },
  );
  return firm.id;
}

async function bumpTerritory(tx: Tx, place: PlaceRow, delta: number) {
  const runId = place.lastRunId ?? place.firstRunId;
  if (!runId || !place.town || !place.state) return;
  const [run] = await tx
    .select({ territoryId: searchRun.territoryId })
    .from(searchRun)
    .where(eq(searchRun.id, runId));
  if (!run?.territoryId) return;
  await tx
    .update(territoryTown)
    .set({ leadsAdded: sql`greatest(0, ${territoryTown.leadsAdded} + ${delta})` })
    .where(
      and(
        eq(territoryTown.territoryId, run.territoryId),
        eq(territoryTown.town, place.town),
        eq(territoryTown.state, place.state),
      ),
    );
}

/** Undo the most recent triage decision. Do-not-call is permanent and can't be undone (D-F5). */
export async function undoLastTriage(
  db: Db,
  ctx: Ctx,
  now: Date,
): Promise<{ undone: TriageKind | null; placeResultId: string | null; message: string }> {
  const [last] = await db
    .select()
    .from(triageDecision)
    .where(and(eq(triageDecision.workspaceId, ctx.workspaceId), isNull(triageDecision.undoneAt)))
    .orderBy(desc(triageDecision.createdAt))
    .limit(1);
  if (!last) return { undone: null, placeResultId: null, message: "Nothing to undo." };
  if (last.decision === "dnc") {
    return {
      undone: null,
      placeResultId: last.placeResultId,
      message: "Do-not-call is permanent and can't be undone.",
    };
  }
  return withAudit(db, ctx, { action: "update", entity: "place_result" }, async (tx) => {
    const [place] = await tx.select().from(placeResult).where(eq(placeResult.id, last.placeResultId));
    if (last.decision === "add" && last.companyId) {
      const firmId = last.companyId;
      const [used] = await tx
        .select({
          n: sql<number>`(select count(*) from ${call} where ${call.companyId} = ${firmId}) + (select count(*) from ${mysteryShop} where ${mysteryShop.companyId} = ${firmId}) + (select count(*) from ${deal} where ${deal.companyId} = ${firmId})`,
        })
        .from(company)
        .where(eq(company.id, firmId));
      if (Number(used?.n ?? 0) > 0)
        throw new Error(
          "This lead already has calls, shops or deals, so adding it can't be undone. Archive it instead.",
        );
      await tx.update(placeResult).set({ companyId: null }).where(eq(placeResult.companyId, firmId));
      await tx
        .update(enrichmentEvidence)
        .set({ companyId: null })
        .where(eq(enrichmentEvidence.companyId, firmId));
      await tx.update(enrichmentRun).set({ companyId: null }).where(eq(enrichmentRun.companyId, firmId));
      await tx.update(review).set({ companyId: null }).where(eq(review.companyId, firmId));
      await tx.update(apiUsage).set({ companyId: null }).where(eq(apiUsage.companyId, firmId));
      await tx.update(triageDecision).set({ companyId: null }).where(eq(triageDecision.companyId, firmId));
      await tx.delete(detectionRun).where(eq(detectionRun.companyId, firmId));
      await tx.delete(scoreHistory).where(eq(scoreHistory.companyId, firmId));
      await tx.delete(company).where(eq(company.id, firmId));
      if (place) await bumpTerritory(tx, place, -1);
      await writeAudit(
        tx,
        ctx,
        { action: "delete", entity: "company" },
        { entityId: firmId, before: { reason: "Undo of triage add" } },
      );
    }
    await tx
      .update(placeResult)
      .set({ triageStatus: last.previousStatus, companyId: null })
      .where(eq(placeResult.id, last.placeResultId));
    await tx.update(triageDecision).set({ undoneAt: now }).where(eq(triageDecision.id, last.id));
    return {
      result: { undone: last.decision, placeResultId: last.placeResultId, message: "Undone." },
      entityId: last.placeResultId,
      after: { undone: last.decision },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Google content expiry (spec §1.4)

/** Replaces or blanks Google-sourced fields older than the cache window. Place IDs are kept. */
export async function purgeExpiredGoogleContent(db: Db, workspaceId: string, now: Date) {
  const cutoff = now.toISOString();
  const places = await db
    .update(placeResult)
    .set({
      displayName: sql`coalesce(${placeResult.websiteName}, ${placeResult.normalizedDomain})`,
      formattedAddress: null,
      types: null,
      businessStatus: null,
      // A website we fetched successfully is the firm's own public page, not Google content.
      websiteUri: sql`case when ${placeResult.enrichmentStatus} = 'done' then ${placeResult.websiteUri} else null end`,
      nationalPhone: null,
      userRatingCount: null,
      googleMapsUri: null,
      googleFetchedAt: null,
      googleExpiresAt: null,
    })
    .where(
      and(
        eq(placeResult.workspaceId, workspaceId),
        lte(placeResult.googleExpiresAt, sql`${cutoff}::timestamptz`),
      ),
    )
    .returning({ id: placeResult.id });

  const firms = await db
    .select()
    .from(company)
    .where(
      and(eq(company.workspaceId, workspaceId), lte(company.googleExpiresAt, sql`${cutoff}::timestamptz`)),
    );
  for (const firm of firms) {
    const [place] = firm.googlePlaceId
      ? await db
          .select()
          .from(placeResult)
          .where(and(eq(placeResult.workspaceId, workspaceId), eq(placeResult.placeId, firm.googlePlaceId)))
      : [];
    const evidence = await db
      .select()
      .from(enrichmentEvidence)
      .where(eq(enrichmentEvidence.companyId, firm.id))
      .orderBy(asc(enrichmentEvidence.createdAt));
    const siteName = place?.websiteName ?? evidence.filter((e) => e.kind === "name").at(-1)?.value ?? null;
    const sitePhone = evidence.filter((e) => e.kind === "phone").at(-1)?.value ?? null;
    const siteFetched = place?.enrichmentStatus === "done";
    const sources: FieldSources = { ...firm.fieldSources };
    const patch: Partial<typeof company.$inferInsert> = { googleExpiresAt: null };
    if (sources.name === "google") {
      patch.name = siteName ?? firm.domain ?? "Unnamed firm (refresh from Google)";
      if (siteName) sources.name = "website";
      else delete sources.name;
    }
    if (sources.phone === "google") {
      patch.phone = sitePhone;
      patch.normalizedPhone = normalizePhone(sitePhone);
      if (sitePhone) sources.phone = "website";
      else delete sources.phone;
    }
    if (sources.address === "google") {
      patch.address = null;
      delete sources.address;
    }
    if (sources.websiteUrl === "google") {
      if (siteFetched) sources.websiteUrl = "website";
      else {
        patch.websiteUrl = null;
        delete sources.websiteUrl;
      }
    }
    patch.fieldSources = sources;
    await db.update(company).set(patch).where(eq(company.id, firm.id));
  }

  const reviews = await db
    .delete(review)
    .where(
      and(
        eq(review.workspaceId, workspaceId),
        eq(review.source, "google_places"),
        lte(review.expiresAt, sql`${cutoff}::timestamptz`),
      ),
    )
    .returning({ id: review.id });

  return { places: places.length, companies: firms.length, reviews: reviews.length };
}
