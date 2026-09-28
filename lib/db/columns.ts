import { uuid } from "drizzle-orm/pg-core";
import { appUser, workspace } from "@/lib/db/schema/workspace";
import { timestamps } from "@/lib/db/timestamps";

/**
 * Columns every workspace-owned table carries, so the app can go multi-user later.
 * Column names are written out in snake_case on purpose: the SQL is identical on
 * PGlite today and Neon later, with no naming config to keep in sync.
 */
export function baseColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => appUser.id),
    ...timestamps(),
  };
}
