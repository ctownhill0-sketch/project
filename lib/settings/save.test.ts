import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, setting } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { getSetting } from "@/lib/queries/settings";
import { saveSetting } from "@/lib/settings/save";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

describe("saveSetting", () => {
  it("creates, then updates one row per key, with an audit row each time", async () => {
    const { userId, workspaceId } = await insertOwner(handle.db);
    const ctx = { userId, workspaceId };
    await saveSetting(handle.db, ctx, "finder.caps", { search: { daily: 50, monthly: 500 } });
    await saveSetting(handle.db, ctx, "finder.caps", { search: { daily: 60, monthly: 500 } });
    expect(await getSetting(handle.db, workspaceId, "finder.caps", null)).toEqual({
      search: { daily: 60, monthly: 500 },
    });
    expect(await handle.db.select().from(setting).where(eq(setting.workspaceId, workspaceId))).toHaveLength(
      1,
    );
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.workspaceId, workspaceId));
    expect(audits.map((a) => a.action)).toEqual(["create", "update"]);
  });
});
