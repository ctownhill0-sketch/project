import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";
import { company } from "@/lib/db/schema/leads";

export const shopChannel = pgEnum("shop_channel", ["email", "phone", "listing_site", "website_form"]);

/** Computed from sent_at in America/New_York using the business-hours setting. */
export const hoursBucket = pgEnum("hours_bucket", ["business", "saturday", "after_hours"]);

export const replyType = pgEnum("reply_type", ["human", "auto", "ai", "none"]);

export const mysteryShop = pgTable(
  "mystery_shop",
  {
    ...baseColumns(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    channel: shopChannel("channel").notNull(),
    listingRef: text("listing_ref"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    hoursBucket: hoursBucket("hours_bucket").notNull(),
    firstReplyAt: timestamp("first_reply_at", { withTimezone: true }),
    firstHumanReplyAt: timestamp("first_human_reply_at", { withTimezone: true }),
    replyType: replyType("reply_type").notNull().default("none"),
    questionsAnswered: integer("questions_answered").notNull().default(0),
    followUpsIn7d: integer("follow_ups_in_7d").notNull().default(0),
    tourOffered: boolean("tour_offered").notNull().default(false),
    /** The founder's real name (ethics rule). Redacted in audit diffs. */
    shopperName: text("shopper_name").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("mystery_shop_company_idx").on(t.companyId, t.sentAt),
    check("mystery_shop_questions_answered_range", sql`${t.questionsAnswered} between 0 and 4`),
    check("mystery_shop_follow_ups_nonneg", sql`${t.followUpsIn7d} >= 0`),
  ],
);
