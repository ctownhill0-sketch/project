import { createDb, type DbHandle } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

/** A fresh, fully migrated in-memory database for one test file. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await createDb({ driver: "pglite", dir: "memory://" });
  await runMigrations(handle);
  return handle;
}
