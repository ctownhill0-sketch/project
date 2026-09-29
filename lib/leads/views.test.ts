import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { deleteSavedView, listSavedViews, saveSavedView, sanitizeViewQuery } from "@/lib/leads/views";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

describe("sanitizeViewQuery", () => {
  it("keeps only known filters, in a stable order", () => {
    expect(sanitizeViewQuery("?software=yardi&lead=abc&status=ready&evil=<x>")).toBe(
      "status=ready&software=yardi",
    );
    expect(sanitizeViewQuery("")).toBe("");
  });
});

describe("saved views", () => {
  it("saves, replaces by name, lists and deletes", async () => {
    const o = await insertOwner(handle.db);
    const ctx = { userId: o.userId, workspaceId: o.workspaceId };
    await saveSavedView(handle.db, ctx, "Ready in NJ", "status=ready&lead=1");
    await saveSavedView(handle.db, ctx, "New", "status=new");
    await saveSavedView(handle.db, ctx, "Ready in NJ", "status=ready&software=none");
    expect(await listSavedViews(handle.db, ctx.workspaceId)).toEqual([
      { name: "Ready in NJ", query: "status=ready&software=none" },
      { name: "New", query: "status=new" },
    ]);
    await deleteSavedView(handle.db, ctx, "New");
    expect((await listSavedViews(handle.db, ctx.workspaceId)).map((v) => v.name)).toEqual(["Ready in NJ"]);
  });

  it("caps the list at 20 views", async () => {
    const o = await insertOwner(handle.db);
    const ctx = { userId: o.userId, workspaceId: o.workspaceId };
    for (let i = 0; i < 20; i += 1) await saveSavedView(handle.db, ctx, `View ${i}`, "status=new");
    await expect(saveSavedView(handle.db, ctx, "One more", "status=new")).rejects.toThrow(/20/);
  });
});
