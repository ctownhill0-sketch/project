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
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";
import { company } from "@/lib/db/schema/leads";
import { placeResult } from "@/lib/db/schema/finder";

// M2 listings monitor and M3 review finder are deferred in the Free Build.
// These tables exist so reviving them needs no schema change.

export const listing = pgTable(
  "listing",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    externalRef: text("external_ref").notNull(),
    title: text("title"),
    url: text("url"),
    bedrooms: numeric("bedrooms", { precision: 3, scale: 1 }),
    /** Display only, per firm. Never pooled or compared across firms (antitrust guardrail). */
    rentDisplay: integer("rent_display"),
    isActive: boolean("is_active").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_company_idx").on(t.companyId)],
);

export const listingSnapshot = pgTable("listing_snapshot", {
  ...baseColumns(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => company.id),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  listingCount: integer("listing_count").notNull(),
  contentHash: text("content_hash").notNull(),
  listingRefs: jsonb("listing_refs").$type<string[]>().notNull().default([]),
});

export const alertKind = pgEnum("alert_kind", [
  "call_now",
  "guarantee_at_risk",
  "reply_check_due",
  "job_failed",
]);

export const alert = pgTable(
  "alert",
  {
    ...baseColumns(),
    kind: alertKind("kind").notNull(),
    companyId: uuid("company_id").references(() => company.id),
    message: text("message").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("alert_open_idx").on(t.workspaceId, t.resolvedAt)],
);

export const review = pgTable("review", {
  ...baseColumns(),
  companyId: uuid("company_id").references(() => company.id),
  /** Set when the review was fetched during triage, before the place became a lead. */
  placeResultId: uuid("place_result_id").references(() => placeResult.id),
  source: text("source").notNull().default("google_places"),
  rating: integer("rating"),
  text: text("text"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  /** Attribution text as required by the source's terms. */
  attribution: text("attribution"),
  authorName: text("author_name"),
  authorUri: text("author_uri"),
  /** Google reviews are a short-lived cache (finder spec §1.4). */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const reviewCategory = pgEnum("review_category", [
  "never_called_back",
  "no_response",
  "slow_response",
  "other",
  "none",
]);

export const reviewClassification = pgTable("review_classification", {
  ...baseColumns(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => review.id),
  category: reviewCategory("category").notNull(),
  quote: text("quote"),
  promptVersion: text("prompt_version"),
});
