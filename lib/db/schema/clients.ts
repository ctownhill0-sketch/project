import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
import { company } from "@/lib/db/schema/leads";

export const clientStatus = pgEnum("client_status", ["pilot", "active", "churned"]);

export const client = pgTable("client", {
  ...baseColumns(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => company.id),
  status: clientStatus("status").notNull().default("pilot"),
  startedOn: date("started_on").notNull(),
  churnedOn: date("churned_on"),
});

export const vacancy = pgTable("vacancy", {
  ...baseColumns(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id),
  label: text("label").notNull(),
  listedOn: date("listed_on"),
  leasedOn: date("leased_on"),
  /** The firm's typical days on market before Vacancy Desk, for the "vs baseline" metric. */
  baselineDaysOnMarket: integer("baseline_days_on_market"),
  isListed: boolean("is_listed").notNull().default(true),
});

export const pilotStatus = pgEnum("pilot_status", ["running", "met", "missed", "cancelled"]);

export const pilot = pgTable("pilot", {
  ...baseColumns(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id),
  day0: date("day0").notNull(),
  tourTarget: integer("tour_target").notNull().default(5),
  status: pilotStatus("status").notNull().default("running"),
});

/** One row per vacancy per day, entered by hand in the Free Build. */
export const pilotMetric = pgTable(
  "pilot_metric",
  {
    ...baseColumns(),
    pilotId: uuid("pilot_id")
      .notNull()
      .references(() => pilot.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancy.id),
    day: date("day").notNull(),
    inquiries: integer("inquiries").notNull().default(0),
    medianReplySeconds: integer("median_reply_seconds"),
    p90ReplySeconds: integer("p90_reply_seconds"),
    tours: integer("tours").notNull().default(0),
    applications: integer("applications").notNull().default(0),
    escalations: integer("escalations").notNull().default(0),
    fairHousingFlags: integer("fair_housing_flags").notNull().default(0),
    humanMinutes: integer("human_minutes").notNull().default(0),
  },
  (t) => [
    uniqueIndex("pilot_metric_vacancy_day_uq").on(t.vacancyId, t.day),
    check(
      "pilot_metric_nonneg",
      sql`${t.inquiries} >= 0 and ${t.tours} >= 0 and ${t.applications} >= 0 and ${t.escalations} >= 0 and ${t.fairHousingFlags} >= 0 and ${t.humanMinutes} >= 0`,
    ),
  ],
);

// M11 owner reports are deferred in the Free Build; tables stay empty.
export const reportStatus = pgEnum("report_status", ["draft", "approved", "sent"]);

export const ownerReport = pgTable(
  "owner_report",
  {
    ...baseColumns(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    /** Only a hash of the public token is stored, so tokens can't be read back. */
    tokenHash: text("token_hash").notNull(),
    status: reportStatus("status").notNull().default("draft"),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [uniqueIndex("owner_report_token_hash_uq").on(t.tokenHash)],
);

export const reportView = pgTable(
  "report_view",
  {
    ...baseColumns(),
    ownerReportId: uuid("owner_report_id")
      .notNull()
      .references(() => ownerReport.id),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    userAgentHash: text("user_agent_hash").notNull(),
    isNewDevice: boolean("is_new_device").notNull().default(false),
  },
  (t) => [index("report_view_report_idx").on(t.ownerReportId)],
);
