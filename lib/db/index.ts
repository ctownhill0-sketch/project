import path from "node:path";
import { createDb, type Db, type DbHandle } from "@/lib/db/client";
import { acquireLock, releaseLock } from "@/lib/db/lock";
import { parseEnv } from "@/lib/env";

// Cached on globalThis so Next.js hot reload doesn't open a second PGlite instance.
const cache = globalThis as unknown as { __vdDb?: Promise<DbHandle> };

async function open(source: Record<string, string | undefined>): Promise<DbHandle> {
  const env = parseEnv(source);
  if (env.DATABASE_DRIVER === "neon") return createDb({ driver: "neon", url: env.DATABASE_URL });

  const inMemory = env.PGLITE_DIR.startsWith("memory://");
  if (!inMemory) {
    const lockDir = path.dirname(path.resolve(env.PGLITE_DIR));
    acquireLock(lockDir);
    process.once("exit", () => releaseLock(lockDir));
  }
  return createDb({ driver: "pglite", dir: env.PGLITE_DIR });
}

/** The app's database. Server-only. */
export async function getDb(source: Record<string, string | undefined> = process.env): Promise<Db> {
  cache.__vdDb ??= open(source);
  return (await cache.__vdDb).db;
}
