import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, company, roiScenario } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { saveRoiScenario } from "@/lib/roi/service";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function setup() {
  const o = await insertOwner(handle.db);
  const [firm] = await handle.db
    .insert(company)
    .values({ ...o.own, name: "Harborline Residential", normalizedName: "harborline" })
    .returning();
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, firm: firm! };
}

describe("saveRoiScenario", () => {
  it("stores inputs and results from the query, audited", async () => {
    const { ctx, firm } = await setup();
    const saved = await saveRoiScenario(handle.db, ctx, firm.id, "rent=2400&turnoversPerYear=10");
    expect(saved.name).toBe("Harborline Residential");
    const [row] = await handle.db.select().from(roiScenario).where(eq(roiScenario.companyId, firm.id));
    expect(row!.inputs).toMatchObject({ rent: 2400, turnoversPerYear: 10, daysVacant: 30 });
    expect(row!.results.dailyCost).toBeCloseTo(78.9, 1);
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.entityId, row!.id));
    expect(audits).toHaveLength(1);
  });

  it("leaves paybackMonths out when the fee never pays back", async () => {
    const { ctx, firm } = await setup();
    await saveRoiScenario(handle.db, ctx, firm.id, "daysFaster=0");
    const [row] = await handle.db.select().from(roiScenario).where(eq(roiScenario.companyId, firm.id));
    expect(row!.results).not.toHaveProperty("paybackMonths");
  });

  it("refuses a lead from another workspace", async () => {
    const { firm } = await setup();
    const other = await insertOwner(handle.db);
    await expect(
      saveRoiScenario(handle.db, { userId: other.userId, workspaceId: other.workspaceId }, firm.id, ""),
    ).rejects.toThrow("Lead not found.");
  });
});
