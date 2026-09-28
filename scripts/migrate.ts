import { createDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { parseEnv } from "@/lib/env";

async function main() {
  const env = parseEnv(process.env);
  const handle =
    env.DATABASE_DRIVER === "pglite"
      ? await createDb({ driver: "pglite", dir: env.PGLITE_DIR })
      : await createDb({ driver: "neon", url: env.DATABASE_URL });
  await runMigrations(handle);
  await handle.close();
  console.log(`Database is up to date (${env.DATABASE_DRIVER}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
