import { pgEnum, pgTable, text, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps } from "@/lib/db/timestamps";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ...timestamps(),
});

// "user" is a reserved word in Postgres, so the table is app_user.
export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("app_user_email_uq").on(t.email)],
);

export const membershipRole = pgEnum("membership_role", ["owner"]);

export const membership = pgTable(
  "membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => appUser.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    role: membershipRole("role").notNull().default("owner"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("membership_workspace_user_uq").on(t.workspaceId, t.userId)],
);
