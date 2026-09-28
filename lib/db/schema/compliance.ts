import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";
import { client } from "@/lib/db/schema/clients";

// M13 Company Brain, M12 tagger and M16 content engine are deferred; tables stay empty.

export const companyBrain = pgTable("company_brain", {
  ...baseColumns(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id),
  publishedVersion: integer("published_version"),
});

export const brainVersionStatus = pgEnum("brain_version_status", ["draft", "published"]);

export const companyBrainVersion = pgTable(
  "company_brain_version",
  {
    ...baseColumns(),
    brainId: uuid("brain_id")
      .notNull()
      .references(() => companyBrain.id),
    version: integer("version").notNull(),
    sections: jsonb("sections").$type<Record<string, string>>().notNull(),
    changelog: text("changelog"),
    status: brainVersionStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("company_brain_version_uq").on(t.brainId, t.version)],
);

export const fairHousingSeverity = pgEnum("fair_housing_severity", ["warn", "block"]);

/** Layer 1 of M14: an editable regex list. */
export const fairHousingRule = pgTable("fair_housing_rule", {
  ...baseColumns(),
  /** JavaScript regex source, matched case-insensitively. */
  pattern: text("pattern").notNull(),
  category: text("category").notNull(),
  severity: fairHousingSeverity("severity").notNull(),
  explanation: text("explanation").notNull(),
  saferRewrite: text("safer_rewrite"),
  isActive: boolean("is_active").notNull().default(true),
});

export const fairHousingOutcome = pgEnum("fair_housing_outcome", ["pass", "warn", "block"]);

export type FairHousingMatch = {
  ruleId: string;
  phrase: string;
  category: string;
  severity: "warn" | "block";
};

export const fairHousingCheck = pgTable(
  "fair_housing_check",
  {
    ...baseColumns(),
    /** What was checked, e.g. "script" or "vacancy_audit". */
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    textHash: text("text_hash").notNull(),
    layer: integer("layer").notNull().default(1),
    outcome: fairHousingOutcome("outcome").notNull(),
    matches: jsonb("matches").$type<FairHousingMatch[]>().notNull().default([]),
    overrideReason: text("override_reason"),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
  },
  (t) => [index("fair_housing_check_entity_idx").on(t.entityType, t.entityId)],
);

export const transcript = pgTable("transcript", {
  ...baseColumns(),
  clientId: uuid("client_id").references(() => client.id),
  /** Stored only after personal details are stripped. */
  redactedText: text("redacted_text").notNull(),
  /** Set when a protected characteristic is mentioned. Never tagged, only reviewed. */
  sensitiveContentPresent: boolean("sensitive_content_present").notNull().default(false),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

/** The ONLY allowed tags (brief M12). Anything else is rejected by the enum. */
export const objectionTagKind = pgEnum("objection_tag_kind", [
  "price",
  "parking",
  "pets",
  "laundry",
  "commute",
  "move_in_date",
  "no_response",
  "no_show",
]);

export const objectionTag = pgTable("objection_tag", {
  ...baseColumns(),
  transcriptId: uuid("transcript_id")
    .notNull()
    .references(() => transcript.id),
  tag: objectionTagKind("tag").notNull(),
  quote: text("quote").notNull(),
});

export const draftStatus = pgEnum("draft_status", ["draft", "approved", "rejected"]);

export const contentDraft = pgTable("content_draft", {
  ...baseColumns(),
  body: text("body").notNull(),
  status: draftStatus("status").notNull().default("draft"),
  anonymizationPassed: boolean("anonymization_passed").notNull().default(false),
  fairHousingCheckId: uuid("fair_housing_check_id"),
});
