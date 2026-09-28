import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { deal } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertCompany, insertOwner, insertStage } from "@/lib/db/test-fixtures";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

describe("deal constraints", () => {
  it("allows only one open deal per company", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own);
    const stage = await insertStage(db, own);
    const openDeal = { ...own, companyId: firm.id, stageId: stage.id, probability: 5, expectedMrr: "20.00" };

    await db.insert(deal).values(openDeal);
    await expect(db.insert(deal).values(openDeal)).rejects.toThrow();
    // A closed deal doesn't count.
    await expect(db.insert(deal).values({ ...openDeal, closedAt: new Date() })).resolves.toBeDefined();
  });
});
