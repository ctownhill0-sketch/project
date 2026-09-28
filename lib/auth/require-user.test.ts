import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { findLocalOwner } from "@/lib/auth/require-user";

let handle: DbHandle;
beforeEach(async () => {
  handle = await createTestDb();
});
afterEach(async () => {
  await handle.close();
});

describe("findLocalOwner", () => {
  it("returns the owner's user and workspace ids", async () => {
    const { userId, workspaceId } = await insertOwner(handle.db);
    await expect(findLocalOwner(handle.db)).resolves.toEqual({ userId, workspaceId });
  });

  it("explains how to fix an empty database", async () => {
    await expect(findLocalOwner(handle.db)).rejects.toThrow("No local owner found. Run pnpm db:setup.");
  });
});
