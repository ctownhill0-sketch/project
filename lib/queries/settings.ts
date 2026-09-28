import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { setting } from "@/lib/db/schema";

/** A workspace setting, or the fallback when it hasn't been saved. */
export async function getSetting<T>(db: Db, workspaceId: string, key: string, fallback: T): Promise<T> {
  const [row] = await db
    .select({ value: setting.value })
    .from(setting)
    .where(and(eq(setting.workspaceId, workspaceId), eq(setting.key, key)));
  return (row?.value as T | undefined) ?? fallback;
}
