import path from "node:path";
import { createDb } from "@/lib/db/client";
import { acquireLock, releaseLock } from "@/lib/db/lock";
import { runMigrations } from "@/lib/db/migrate";
import { parseEnv } from "@/lib/env";

async function main() {
  const env = parseEnv(process.env);
  if (env.DATABASE_DRIVER === "neon") {
    const handle = await createDb({ driver: "neon", url: env.DATABASE_URL });
    await runMigrations(handle);
    await handle.close();
  } else {
    const lockDir = path.dirname(path.resolve(env.PGLITE_DIR));
    acquireLock(lockDir);
    try {
      const handle = await createDb({ driver: "pglite", dir: env.PGLITE_DIR });
      await runMigrations(handle);
      await handle.close();
    } finally {
      releaseLock(lockDir);
    }
  }
  console.log(`Database is up to date (${env.DATABASE_DRIVER}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
