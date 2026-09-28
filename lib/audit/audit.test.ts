import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, company } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { redact, withAudit } from "@/lib/audit/audit";

let handle: DbHandle;
beforeEach(async () => {
  handle = await createTestDb();
});
afterEach(async () => {
  await handle.close();
});

describe("withAudit", () => {
  it("writes the change and one audit row in the same transaction", async () => {
    const { db } = handle;
    const { userId, workspaceId } = await insertOwner(db);
    const created = await withAudit(
      db,
      { userId, workspaceId },
      { action: "create", entity: "company" },
      async (tx) => {
        const [row] = await tx
          .insert(company)
          .values({
            workspaceId,
            createdById: userId,
            name: "Harborline Residential",
            normalizedName: "harborline residential",
            phone: "+12125550142",
          })
          .returning();
        if (!row) throw new Error("insert failed");
        return { result: row, entityId: row.id, after: row };
      },
    );

    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "create",
      entity: "company",
      entityId: created.id,
      workspaceId,
      createdById: userId,
    });
    expect(rows[0]?.diff).toMatchObject({ after: { name: "Harborline Residential", phone: "[redacted]" } });
  });

  it("rolls back both the change and the audit row when the work fails", async () => {
    const { db } = handle;
    const { userId, workspaceId } = await insertOwner(db);
    await expect(
      withAudit(db, { userId, workspaceId }, { action: "create", entity: "company" }, async (tx) => {
        await tx
          .insert(company)
          .values({ workspaceId, createdById: userId, name: "Quarry Oak", normalizedName: "quarry oak" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.select().from(auditLog)).toHaveLength(0);
    expect(await db.select().from(company)).toHaveLength(0);
  });
});

describe("redact", () => {
  it("hides personal fields at any depth and keeps the rest", () => {
    expect(
      redact({
        name: "Brightwater",
        email: "a@b.example",
        nested: { shopperName: "Me", phone: "1", normalizedPhone: "2", ok: 1 },
      }),
    ).toEqual({
      name: "Brightwater",
      email: "[redacted]",
      nested: { shopperName: "[redacted]", phone: "[redacted]", normalizedPhone: "[redacted]", ok: 1 },
    });
  });
});
