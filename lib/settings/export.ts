// Data export (brief M18): every workspace table as JSON. The database holds no secrets (the
// Google key lives in .env.local only), so nothing needs stripping beyond other workspaces.
import { eq, getTableName, is } from "drizzle-orm";
import { PgTable, type PgColumn } from "drizzle-orm/pg-core";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

type WorkspaceTable = PgTable & { workspaceId: PgColumn };
const TABLES = (Object.values(schema) as unknown[]).filter(
  (t) => is(t, PgTable) && "workspaceId" in (t as object),
) as WorkspaceTable[];

export async function exportWorkspace(db: Db, workspaceId: string, now: Date) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    tables[getTableName(table)] = (await db
      .select()
      .from(table)
      .where(eq(table.workspaceId, workspaceId))) as Record<string, unknown>[];
  }
  return { format: "vacancy-desk-export", version: 1, exportedAt: now.toISOString(), workspaceId, tables };
}
