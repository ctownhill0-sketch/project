import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { company, contact } from "@/lib/db/schema/leads";

/** Who wrote a piece of text. "ai" stays unused until an AI-HOOK goes live. */
export const authorKind = pgEnum("author_kind", ["founder", "template", "ai"]);

export const brief = pgTable("brief", {
  ...baseColumns(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => company.id),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  author: authorKind("author").notNull().default("template"),
  promptVersion: text("prompt_version"),
});

export const scriptKind = pgEnum("script_kind", [
  "gatekeeper",
  "opener_with_result",
  "opener_without_result",
  "voicemail",
  "follow_up",
  "pilot_close",
]);

export const script = pgTable("script", {
  ...baseColumns(),
  kind: scriptKind("kind").notNull(),
  name: text("name").notNull(),
  /** Body with {{variables}} filled from lead data at call time. */
  body: text("body").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const objection = pgTable("objection", {
  ...baseColumns(),
  title: text("title").notNull(),
  response: text("response").notNull(),
  category: text("category"),
  timesHeard: integer("times_heard").notNull().default(0),
});

/** Order matches hotkeys 1–9 in the call workspace. do_not_call is permanent. */
export const callDisposition = pgEnum("call_disposition", [
  "no_answer",
  "left_voicemail",
  "gatekeeper",
  "callback",
  "conversation",
  "audit_booked",
  "not_interested",
  "wrong_number",
  "do_not_call",
]);

export const call = pgTable(
  "call",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    contactId: uuid("contact_id").references(() => contact.id),
    calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
    disposition: callDisposition("disposition").notNull(),
    isDecisionMakerConversation: boolean("is_decision_maker_conversation").notNull().default(false),
    notes: text("notes"),
    nextStepAt: timestamp("next_step_at", { withTimezone: true }),
    nextStepNote: text("next_step_note"),
  },
  (t) => [
    index("call_company_idx").on(t.companyId, t.calledAt),
    index("call_next_step_idx").on(t.workspaceId, t.nextStepAt),
  ],
);

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    ...baseColumns(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    /** Default win probability for deals entering this stage, 0–100. */
    probability: integer("probability").notNull(),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
  },
  (t) => [
    uniqueIndex("pipeline_stage_workspace_key_uq").on(t.workspaceId, t.key),
    check("pipeline_stage_probability_range", sql`${t.probability} between 0 and 100`),
  ],
);

export const deal = pgTable(
  "deal",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStage.id),
    vacancies: integer("vacancies").notNull().default(2),
    probability: integer("probability").notNull(),
    /** max(400, vacancies × 119) × probability, recomputed on every change. */
    expectedMrr: numeric("expected_mrr", { precision: 10, scale: 2 }).notNull(),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ghlOpportunityId: text("ghl_opportunity_id"),
  },
  (t) => [
    index("deal_stage_idx").on(t.workspaceId, t.stageId),
    check("deal_probability_range", sql`${t.probability} between 0 and 100`),
    check("deal_vacancies_positive", sql`${t.vacancies} >= 1`),
  ],
);

export const stageEvent = pgTable(
  "stage_event",
  {
    ...baseColumns(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id),
    fromStageId: uuid("from_stage_id").references(() => pipelineStage.id),
    toStageId: uuid("to_stage_id")
      .notNull()
      .references(() => pipelineStage.id),
    movedAt: timestamp("moved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stage_event_deal_idx").on(t.dealId, t.movedAt)],
);

export const vacancyAudit = pgTable("vacancy_audit", {
  ...baseColumns(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => company.id),
  /** The 3-sentence summary. Written by the founder in the Free Build (AI-HOOK(M8)). */
  summary: text("summary"),
  summaryAuthor: authorKind("summary_author").notNull().default("founder"),
  /** Frozen copy of the numbers the PDF shows, so the grounding check is reproducible. */
  dataSnapshot: jsonb("data_snapshot").$type<Record<string, unknown>>().notNull(),
  fairHousingCheckId: uuid("fair_housing_check_id"),
  pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
});

export const roiScenario = pgTable("roi_scenario", {
  ...baseColumns(),
  companyId: uuid("company_id").references(() => company.id),
  name: text("name").notNull(),
  inputs: jsonb("inputs").$type<Record<string, number>>().notNull(),
  results: jsonb("results").$type<Record<string, number>>().notNull(),
});
