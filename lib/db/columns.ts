import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Columns every table carries so the app can go multi-user later.
 * Column names are written out in snake_case on purpose: the SQL is identical on
 * PGlite today and Neon later, with no naming config to keep in sync.
 */
export function baseColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    createdById: uuid("created_by_id").notNull(),
    ...timestamps(),
  };
}

export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}
