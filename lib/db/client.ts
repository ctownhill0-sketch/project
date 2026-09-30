import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";

export type DbOptions = { driver: "pglite"; dir: string } | { driver: "neon"; url?: string | undefined };

// Both drivers expose the same Drizzle query API. We type everything against the
// PGlite flavour so app code has one Db type; the node-postgres driver is used for
// CI parity with real Postgres now and for Neon after deployment.
export type Db = PgliteDatabase;

export interface DbHandle {
  db: Db;
  driver: DbOptions["driver"];
  close: () => Promise<void>;
  /** A gzip tarball of the whole database (PGlite only). */
  backup?: () => Promise<Blob>;
}

export async function createDb(options: DbOptions): Promise<DbHandle> {
  if (options.driver === "pglite") {
    const client = new PGlite(options.dir);
    await client.waitReady;
    return {
      db: drizzlePglite({ client }),
      driver: "pglite",
      close: () => client.close(),
      backup: () => client.dumpDataDir("gzip"),
    };
  }
  if (!options.url) {
    throw new Error("DATABASE_URL is required when DATABASE_DRIVER=neon");
  }
  const pool = new Pool({ connectionString: options.url });
  const db = drizzleNodePg({ client: pool }) as unknown as Db;
  return { db, driver: "neon", close: () => pool.end() };
}
