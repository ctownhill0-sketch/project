import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, company, deal, pipelineStage, stageEvent } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { PIPELINE_STAGES } from "@/lib/seed";
import { advanceDealForCall, moveDeal, openDeal, updateDealVacancies } from "@/lib/pipeline/service";

const NOW = new Date("2026-09-29T14:00:00Z");
let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function setup() {
  const o = await insertOwner(handle.db);
  await handle.db
    .insert(pipelineStage)
    .values(PIPELINE_STAGES.map((st, i) => ({ ...o.own, ...st, position: i + 1 })));
  const [firm] = await handle.db
    .insert(company)
    .values({ ...o.own, name: "Harborline", normalizedName: "harborline" })
    .returning();
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, firm: firm! };
}
const stageKey = async (dealId: string) => {
  const [row] = await handle.db
    .select({ key: pipelineStage.key })
    .from(deal)
    .innerJoin(pipelineStage, eq(pipelineStage.id, deal.stageId))
    .where(eq(deal.id, dealId));
  return row?.key;
};

describe("deals", () => {
  it("opens one deal per company with expected MRR and a stage event", async () => {
    const { ctx, firm } = await setup();
    const d = await openDeal(handle.db, ctx, firm.id, "new", NOW);
    const again = await openDeal(handle.db, ctx, firm.id, "new", NOW);
    expect(again.id).toBe(d.id);
    expect(d).toMatchObject({ vacancies: 2, probability: 5, expectedMrr: "20.00" });
    expect(await handle.db.select().from(stageEvent).where(eq(stageEvent.dealId, d.id))).toHaveLength(1);
  });

  it("moves with history, recomputes expected MRR, and requires a lost reason", async () => {
    const { ctx, firm } = await setup();
    const d = await openDeal(handle.db, ctx, firm.id, "new", NOW);
    await moveDeal(handle.db, ctx, d.id, "pilot_proposed", {}, NOW);
    const [moved] = await handle.db.select().from(deal).where(eq(deal.id, d.id));
    expect(moved).toMatchObject({ probability: 60, expectedMrr: "240.00", closedAt: null });
    await expect(moveDeal(handle.db, ctx, d.id, "lost", {}, NOW)).rejects.toThrow(/reason/i);
    await moveDeal(handle.db, ctx, d.id, "lost", { lostReason: "Went with a competitor" }, NOW);
    const [lost] = await handle.db.select().from(deal).where(eq(deal.id, d.id));
    expect(lost).toMatchObject({ lostReason: "Went with a competitor", probability: 0, expectedMrr: "0.00" });
    expect(lost!.closedAt).not.toBeNull();
    expect(await handle.db.select().from(stageEvent).where(eq(stageEvent.dealId, d.id))).toHaveLength(3);
    const audits = await handle.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.workspaceId, ctx.workspaceId), eq(auditLog.entity, "deal")));
    expect(audits.length).toBeGreaterThanOrEqual(3);
  });

  it("recomputes expected MRR when vacancies change", async () => {
    const { ctx, firm } = await setup();
    const d = await openDeal(handle.db, ctx, firm.id, "pilot_live", NOW);
    await updateDealVacancies(handle.db, ctx, d.id, 5);
    const [row] = await handle.db.select().from(deal).where(eq(deal.id, d.id));
    expect(row).toMatchObject({ vacancies: 5, expectedMrr: "446.25" }); // 595 × 75%
  });
});

describe("advanceDealForCall", () => {
  it("only moves forward, and closes as lost for not interested", async () => {
    const { ctx, firm } = await setup();
    const d1 = await handle.db.transaction((tx) => advanceDealForCall(tx, ctx, firm.id, "no_answer", NOW));
    expect(await stageKey(d1!)).toBe("called");
    await handle.db.transaction((tx) => advanceDealForCall(tx, ctx, firm.id, "audit_booked", NOW));
    expect(await stageKey(d1!)).toBe("audit_review_booked");
    await handle.db.transaction((tx) => advanceDealForCall(tx, ctx, firm.id, "conversation", NOW));
    expect(await stageKey(d1!)).toBe("audit_review_booked"); // never backwards
    await handle.db.transaction((tx) => advanceDealForCall(tx, ctx, firm.id, "not_interested", NOW));
    const [closed] = await handle.db.select().from(deal).where(eq(deal.id, d1!));
    expect(closed).toMatchObject({ lostReason: "Not interested (on a call)" });
    expect(closed!.closedAt).not.toBeNull();
  });
});
