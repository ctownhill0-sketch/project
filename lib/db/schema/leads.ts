import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";

export const softwareKind = pgEnum("software_kind", [
  "appfolio",
  "buildium",
  "doorloop",
  "rent_manager",
  "yardi",
  "none",
  "unknown",
]);

export const companyStatus = pgEnum("company_status", [
  "new",
  "researching",
  "ready",
  "contacted",
  "excluded",
  "archived",
]);

export const estimateSource = pgEnum("estimate_source", ["csv", "manual", "website", "unknown"]);

/** Score breakdown: one line per scoring rule, so the popover can explain the number. */
export type ScoreBreakdown = { rule: string; points: number; reason: string }[];

export const company = pgTable(
  "company",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    domain: text("domain"),
    normalizedDomain: text("normalized_domain"),
    websiteUrl: text("website_url"),
    phone: text("phone"),
    normalizedPhone: text("normalized_phone"),
    city: text("city"),
    state: text("state"),
    metro: text("metro"),
    isLocal: boolean("is_local").notNull().default(false),
    estUnits: integer("est_units"),
    estUnitsSource: estimateSource("est_units_source").notNull().default("unknown"),
    liveListingsCount: integer("live_listings_count"),
    liveListingsSource: estimateSource("live_listings_source").notNull().default("unknown"),
    detectedSoftware: softwareKind("detected_software").notNull().default("unknown"),
    softwareOverride: softwareKind("software_override"),
    softwareEvidence: text("software_evidence"),
    availableRentalsUrl: text("available_rentals_url"),
    googlePlaceId: text("google_place_id"),
    score: integer("score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>().notNull().default([]),
    status: companyStatus("status").notNull().default("new"),
    dncFlag: boolean("dnc_flag").notNull().default(false),
    importBatchId: uuid("import_batch_id"),
    mergedIntoId: uuid("merged_into_id"),
  },
  (t) => [
    index("company_workspace_score_idx").on(t.workspaceId, t.score),
    index("company_normalized_domain_idx").on(t.workspaceId, t.normalizedDomain),
  ],
);

export const contact = pgTable(
  "contact",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    email: text("email"),
    phone: text("phone"),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    doNotCall: boolean("do_not_call").notNull().default(false),
    doNotEmail: boolean("do_not_email").notNull().default(false),
    notes: text("notes"),
  },
  (t) => [index("contact_company_idx").on(t.companyId)],
);

export const tag = pgTable(
  "tag",
  {
    ...baseColumns(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tag_workspace_name_uq").on(t.workspaceId, t.name)],
);

export const companyTag = pgTable(
  "company_tag",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (t) => [uniqueIndex("company_tag_uq").on(t.companyId, t.tagId)],
);

/** Maps a CSV header to a company/contact field, e.g. { "Company Website": "domain" }. */
export type ColumnMapping = Record<string, string>;

export const importMapping = pgTable(
  "import_mapping",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    mapping: jsonb("mapping").$type<ColumnMapping>().notNull(),
  },
  (t) => [uniqueIndex("import_mapping_workspace_name_uq").on(t.workspaceId, t.name)],
);

export const importStatus = pgEnum("import_status", ["previewed", "committed", "failed"]);

export const importBatch = pgTable("import_batch", {
  ...baseColumns(),
  fileName: text("file_name").notNull(),
  mappingId: uuid("mapping_id").references(() => importMapping.id),
  status: importStatus("status").notNull().default("previewed"),
  rowCount: integer("row_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  possibleDuplicateCount: integer("possible_duplicate_count").notNull().default(0),
  errorMessage: text("error_message"),
});

export const patternKind = pgEnum("pattern_kind", ["domain", "substring"]);

export const softwarePattern = pgTable("software_pattern", {
  ...baseColumns(),
  software: softwareKind("software").notNull(),
  pattern: text("pattern").notNull(),
  kind: patternKind("kind").notNull().default("substring"),
  isActive: boolean("is_active").notNull().default(true),
});

export const detectionMethod = pgEnum("detection_method", ["manual", "auto"]);

export const detectionRun = pgTable(
  "detection_run",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    method: detectionMethod("method").notNull().default("manual"),
    software: softwareKind("software").notNull(),
    evidence: text("evidence"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
  },
  (t) => [index("detection_run_company_idx").on(t.companyId)],
);

export const scoreHistory = pgTable(
  "score_history",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    score: integer("score").notNull(),
    breakdown: jsonb("breakdown").$type<ScoreBreakdown>().notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [index("score_history_company_idx").on(t.companyId)],
);
