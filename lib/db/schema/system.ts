import {
  date,
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

/** Numbers the founder types in once a week (the rest is counted from app data). */
export const weeklyMetric = pgTable(
  "weekly_metric",
  {
    ...baseColumns(),
    weekStart: date("week_start").notNull(),
    mrr: numeric("mrr", { precision: 10, scale: 2 }).notNull().default("0"),
    cash: numeric("cash", { precision: 10, scale: 2 }),
    netBurn: numeric("net_burn", { precision: 10, scale: 2 }),
    paidClients: integer("paid_clients").notNull().default(0),
    insuranceStudyHours: numeric("insurance_study_hours", { precision: 5, scale: 1 }).notNull().default("0"),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("weekly_metric_week_uq").on(t.workspaceId, t.weekStart)],
);

export const setting = pgTable(
  "setting",
  {
    ...baseColumns(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [uniqueIndex("setting_workspace_key_uq").on(t.workspaceId, t.key)],
);

export const auditAction = pgEnum("audit_action", ["create", "update", "delete", "ai_call", "export"]);

export const auditLog = pgTable(
  "audit_log",
  {
    ...baseColumns(),
    action: auditAction("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    /** Before/after values with personal data redacted. */
    diff: jsonb("diff").$type<Record<string, unknown>>(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)],
);

// Background jobs and AI calls are deferred; these tables stay empty in the Free Build.
export const jobStatus = pgEnum("job_status", ["running", "succeeded", "failed"]);

export const jobRun = pgTable(
  "job_run",
  {
    ...baseColumns(),
    jobName: text("job_name").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: jobStatus("status").notNull().default("running"),
    attempts: integer("attempts").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("job_run_idempotency_uq").on(t.idempotencyKey)],
);

export const aiCall = pgTable("ai_call", {
  ...baseColumns(),
  hook: text("hook").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  status: text("status").notNull(),
});

export const emailSuppression = pgTable(
  "email_suppression",
  {
    ...baseColumns(),
    /** Only a hash is stored, so the list can't leak addresses. */
    emailHash: text("email_hash").notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [uniqueIndex("email_suppression_uq").on(t.workspaceId, t.emailHash)],
);
