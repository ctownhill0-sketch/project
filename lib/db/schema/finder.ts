import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";
import { company } from "@/lib/db/schema/leads";
import type { ScoreBreakdown } from "@/lib/db/schema/leads";

// Lead Finder (spec: docs/superpowers/specs/2026-09-29-lead-finder.md §7).

export interface TownRef {
  town: string;
  state: string;
}

export const territory = pgTable(
  "territory",
  {
    ...baseColumns(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("territory_workspace_name_uq").on(t.workspaceId, t.name)],
);

export const territoryTown = pgTable(
  "territory_town",
  {
    ...baseColumns(),
    territoryId: uuid("territory_id")
      .notNull()
      .references(() => territory.id),
    town: text("town").notNull(),
    state: text("state").notNull(),
    position: integer("position").notNull().default(0),
    lastSearchedAt: timestamp("last_searched_at", { withTimezone: true }),
    resultsFound: integer("results_found").notNull().default(0),
    leadsAdded: integer("leads_added").notNull().default(0),
  },
  (t) => [uniqueIndex("territory_town_uq").on(t.territoryId, t.town, t.state)],
);

export const savedSearch = pgTable("saved_search", {
  ...baseColumns(),
  name: text("name").notNull(),
  towns: jsonb("towns").$type<TownRef[]>().notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull(),
  territoryId: uuid("territory_id").references(() => territory.id),
});

export const searchRunStatus = pgEnum("search_run_status", [
  "planned",
  "running",
  "done",
  "stopped_cap",
  "stopped",
  "failed",
]);

export const searchRun = pgTable(
  "search_run",
  {
    ...baseColumns(),
    savedSearchId: uuid("saved_search_id").references(() => savedSearch.id),
    territoryId: uuid("territory_id").references(() => territory.id),
    towns: jsonb("towns").$type<TownRef[]>().notNull(),
    keywords: jsonb("keywords").$type<string[]>().notNull(),
    status: searchRunStatus("status").notNull().default("planned"),
    plannedQueries: integer("planned_queries").notNull().default(0),
    estimatedRequests: integer("estimated_requests").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 2 }).notNull().default("0"),
    requestsUsed: integer("requests_used").notNull().default(0),
    resultsFound: integer("results_found").notNull().default(0),
    newFound: integer("new_found").notNull().default(0),
    error: text("error"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("search_run_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export const searchQueryStatus = pgEnum("search_query_status", ["pending", "done", "failed", "skipped_cap"]);

export const searchQuery = pgTable(
  "search_query",
  {
    ...baseColumns(),
    searchRunId: uuid("search_run_id")
      .notNull()
      .references(() => searchRun.id),
    town: text("town").notNull(),
    state: text("state").notNull(),
    keyword: text("keyword").notNull(),
    position: integer("position").notNull(),
    status: searchQueryStatus("status").notNull().default("pending"),
    pages: integer("pages").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("search_query_run_idx").on(t.searchRunId, t.position)],
);

export const fitStatus = pgEnum("fit_status", ["ok", "excluded", "not_a_fit"]);
export const dedupeStatus = pgEnum("dedupe_status", ["new", "duplicate", "possible_duplicate", "dnc"]);
export const triageStatus = pgEnum("triage_status", ["pending", "added", "skipped", "not_a_fit", "dnc"]);
export const enrichmentStatus = pgEnum("enrichment_status", ["none", "queued", "done", "failed"]);

export const placeResult = pgTable(
  "place_result",
  {
    ...baseColumns(),
    /** Google allows place IDs to be stored indefinitely. */
    placeId: text("place_id").notNull(),
    firstRunId: uuid("first_run_id").references(() => searchRun.id),
    lastRunId: uuid("last_run_id").references(() => searchRun.id),
    town: text("town"),
    state: text("state"),
    // Google cache: blanked or replaced when google_expires_at passes (spec §1.4).
    displayName: text("display_name"),
    formattedAddress: text("formatted_address"),
    types: jsonb("types").$type<string[]>(),
    businessStatus: text("business_status"),
    websiteUri: text("website_uri"),
    nationalPhone: text("national_phone"),
    userRatingCount: integer("user_rating_count"),
    googleMapsUri: text("google_maps_uri"),
    googleFetchedAt: timestamp("google_fetched_at", { withTimezone: true }),
    googleExpiresAt: timestamp("google_expires_at", { withTimezone: true }),
    // Ours (derived, kept).
    websiteName: text("website_name"),
    normalizedDomain: text("normalized_domain"),
    normalizedPhone: text("normalized_phone"),
    fitStatus: fitStatus("fit_status").notNull().default("ok"),
    fitReason: text("fit_reason"),
    fitRuleId: uuid("fit_rule_id"),
    fitOverridden: boolean("fit_overridden").notNull().default(false),
    dedupeStatus: dedupeStatus("dedupe_status").notNull().default("new"),
    dedupeCompanyId: uuid("dedupe_company_id").references(() => company.id),
    dedupeReason: text("dedupe_reason"),
    triageStatus: triageStatus("triage_status").notNull().default("pending"),
    companyId: uuid("company_id").references(() => company.id),
    score: integer("score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>().notNull().default([]),
    why: text("why"),
    enrichmentStatus: enrichmentStatus("enrichment_status").notNull().default("none"),
    reviewFlagCount: integer("review_flag_count"),
  },
  (t) => [
    uniqueIndex("place_result_workspace_place_uq").on(t.workspaceId, t.placeId),
    index("place_result_run_idx").on(t.lastRunId),
  ],
);

export const enrichmentRunStatus = pgEnum("enrichment_run_status", [
  "done",
  "failed",
  "blocked_robots",
  "skipped",
]);

export interface FetchedPage {
  url: string;
  status: number | null;
  bytes: number;
  ms: number;
  skipped?: string;
}

export const enrichmentRun = pgTable(
  "enrichment_run",
  {
    ...baseColumns(),
    placeResultId: uuid("place_result_id").references(() => placeResult.id),
    companyId: uuid("company_id").references(() => company.id),
    url: text("url").notNull(),
    status: enrichmentRunStatus("status").notNull(),
    pages: jsonb("pages").$type<FetchedPage[]>().notNull().default([]),
    error: text("error"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("enrichment_run_place_idx").on(t.placeResultId)],
);

export const evidenceKind = pgEnum("evidence_kind", [
  "software",
  "size_units",
  "listing_count",
  "phone",
  "email",
  "name",
  "service_type",
]);
export const confidence = pgEnum("confidence", ["high", "medium", "low"]);

export const enrichmentEvidence = pgTable(
  "enrichment_evidence",
  {
    ...baseColumns(),
    enrichmentRunId: uuid("enrichment_run_id")
      .notNull()
      .references(() => enrichmentRun.id),
    placeResultId: uuid("place_result_id").references(() => placeResult.id),
    companyId: uuid("company_id").references(() => company.id),
    kind: evidenceKind("kind").notNull(),
    value: text("value").notNull(),
    confidence: confidence("confidence").notNull(),
    sourceUrl: text("source_url").notNull(),
    quote: text("quote"),
  },
  (t) => [
    index("enrichment_evidence_place_idx").on(t.placeResultId),
    index("enrichment_evidence_company_idx").on(t.companyId),
  ],
);

export const exclusionKind = pgEnum("exclusion_kind", ["chain", "not_a_fit"]);
export const exclusionMatch = pgEnum("exclusion_match", ["name", "domain", "type"]);

export const exclusionRule = pgTable("exclusion_rule", {
  ...baseColumns(),
  kind: exclusionKind("kind").notNull(),
  /** For not-a-fit: hoa, commercial, vacation, single_building, sales_only. */
  category: text("category"),
  match: exclusionMatch("match").notNull(),
  pattern: text("pattern").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const triageDecisionKind = pgEnum("triage_decision_kind", ["add", "skip", "not_a_fit", "dnc"]);

export const triageDecision = pgTable(
  "triage_decision",
  {
    ...baseColumns(),
    placeResultId: uuid("place_result_id")
      .notNull()
      .references(() => placeResult.id),
    decision: triageDecisionKind("decision").notNull(),
    previousStatus: triageStatus("previous_status").notNull(),
    companyId: uuid("company_id").references(() => company.id),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [index("triage_decision_created_idx").on(t.workspaceId, t.createdAt)],
);

export const apiSku = pgEnum("api_sku", [
  "text_search_enterprise",
  "text_search_ids",
  "place_details_atmosphere",
]);
export const apiOutcome = pgEnum("api_outcome", ["sent", "failed", "blocked_cap"]);

export const apiUsage = pgTable(
  "api_usage",
  {
    ...baseColumns(),
    sku: apiSku("sku").notNull(),
    outcome: apiOutcome("outcome").notNull(),
    httpStatus: integer("http_status"),
    searchRunId: uuid("search_run_id").references(() => searchRun.id),
    companyId: uuid("company_id").references(() => company.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_usage_workspace_time_idx").on(t.workspaceId, t.requestedAt)],
);

export const dncKind = pgEnum("dnc_kind", ["place_id", "domain", "phone"]);

/** Permanent do-not-call list for firms that aren't leads (yet). Triggers forbid update and delete. */
export const dncEntry = pgTable(
  "dnc_entry",
  {
    ...baseColumns(),
    kind: dncKind("kind").notNull(),
    value: text("value").notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [uniqueIndex("dnc_entry_uq").on(t.workspaceId, t.kind, t.value)],
);
