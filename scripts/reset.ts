import { rmSync } from "node:fs";
import path from "node:path";
import { acquireLock, releaseLock } from "@/lib/db/lock";
import { parseEnv } from "@/lib/env";

// Deletes the local database folder only. Why: start over with fresh demo data.
// Takes the lock first, so it refuses while `pnpm dev` is using the database.
const env = parseEnv(process.env);
if (env.DATABASE_DRIVER !== "pglite") throw new Error("Reset only works on the local database.");
const lockDir = path.dirname(path.resolve(env.PGLITE_DIR));
try {
  acquireLock(lockDir);
  rmSync(path.resolve(env.PGLITE_DIR), { recursive: true, force: true });
  console.log(`Deleted ${env.PGLITE_DIR}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  releaseLock(lockDir);
}
