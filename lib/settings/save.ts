import { and, eq } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { setting } from "@/lib/db/schema";

/** Upserts one workspace setting through the audit log. */
export async function saveSetting(db: Db, ctx: AuditContext, key: string, value: unknown): Promise<void> {
  const [existing] = await db
    .select()
    .from(setting)
    .where(and(eq(setting.workspaceId, ctx.workspaceId), eq(setting.key, key)));
  await withAudit(db, ctx, { action: existing ? "update" : "create", entity: "setting" }, async (tx) => {
    if (existing) {
      await tx.update(setting).set({ value }).where(eq(setting.id, existing.id));
      return {
        result: null,
        entityId: existing.id,
        before: { key, value: existing.value },
        after: { key, value },
      };
    }
    const [row] = await tx
      .insert(setting)
      .values({ workspaceId: ctx.workspaceId, createdById: ctx.userId, key, value })
      .returning();
    return { result: null, entityId: row!.id, after: { key, value } };
  });
}
