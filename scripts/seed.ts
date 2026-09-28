import path from "node:path";
import { createDb } from "@/lib/db/client";
import { acquireLock, releaseLock } from "@/lib/db/lock";
import { parseEnv } from "@/lib/env";
import { seed } from "@/lib/seed";

async function main() {
  const env = parseEnv(process.env);
  if (env.DATABASE_DRIVER !== "pglite") throw new Error("Demo data only goes into the local database.");
  const lockDir = path.dirname(path.resolve(env.PGLITE_DIR));
  acquireLock(lockDir);
  try {
    const handle = await createDb({ driver: "pglite", dir: env.PGLITE_DIR });
    const result = await seed(handle.db);
    await handle.close();
    console.log(result.summary);
  } finally {
    releaseLock(lockDir);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
