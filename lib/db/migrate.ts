import path from "node:path";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbHandle } from "@/lib/db/client";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function runMigrations(handle: DbHandle): Promise<void> {
  const config = { migrationsFolder: MIGRATIONS_FOLDER };
  if (handle.driver === "pglite") {
    await migratePglite(handle.db, config);
  } else {
    await migrateNodePg(handle.db as unknown as NodePgDatabase, config);
  }
}
