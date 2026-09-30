import path from "node:path";
import { createDb, type Db, type DbHandle } from "@/lib/db/client";
import { acquireLock, releaseLock } from "@/lib/db/lock";
import { parseEnv } from "@/lib/env";

// Cached on globalThis so Next.js hot reload doesn't open a second PGlite instance.
const cache = globalThis as unknown as { __vdDb?: Promise<DbHandle> | undefined };

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

/** The app's database. Server-only. A failed open isn't cached, so fixing the cause and retrying works. */
export async function getDb(source: Record<string, string | undefined> = process.env): Promise<Db> {
  cache.__vdDb ??= open(source).catch((error: unknown) => {
    cache.__vdDb = undefined;
    throw error;
  });
  return (await cache.__vdDb).db;
}

/** The open handle, for the few callers that need more than queries (the backup download). */
export async function getDbHandle(): Promise<DbHandle> {
  await getDb();
  return cache.__vdDb!;
}

export function resetDbCacheForTests(): void {
  cache.__vdDb = undefined;
}
