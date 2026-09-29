import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { call, company, deal, objection, pipelineStage } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { PIPELINE_STAGES } from "@/lib/seed";
import { logCall, recordObjectionHeard } from "@/lib/calls/service";

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
    .values({
      ...o.own,
      name: "Harborline",
      normalizedName: "harborline",
      phone: "(201) 555-0142",
      normalizedPhone: "2015550142",
    })
    .returning();
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, firm: firm!, own: o.own };
}

describe("logCall", () => {
  it("records the call, marks the lead contacted, advances the deal and suggests a next step", async () => {
    const { ctx, firm } = await setup();
    const c = await logCall(handle.db, ctx, { companyId: firm.id, disposition: "no_answer" }, NOW);
    expect(c.nextStepAt!.toISOString()).toBe("2026-09-30T14:00:00.000Z");
    const [f] = await handle.db.select().from(company).where(eq(company.id, firm.id));
    expect(f!.status).toBe("contacted");
    expect(await handle.db.select().from(deal).where(eq(deal.companyId, firm.id))).toHaveLength(1);
  });

  it("keeps a chosen callback time and the decision-maker flag", async () => {
    const { ctx, firm } = await setup();
    const at = new Date("2026-10-01T18:30:00Z");
    const c = await logCall(
      handle.db,
      ctx,
      {
        companyId: firm.id,
        disposition: "callback",
        nextStepAt: at,
        nextStepNote: "Ask for Sam",
        isDecisionMakerConversation: true,
        notes: "Busy",
      },
      NOW,
    );
    expect(c).toMatchObject({ nextStepNote: "Ask for Sam", isDecisionMakerConversation: true });
    expect(c.nextStepAt!.toISOString()).toBe(at.toISOString());
  });

  it("do not call is permanent: flags the firm, closes the deal, and blocks further calls", async () => {
    const { ctx, firm } = await setup();
    await logCall(handle.db, ctx, { companyId: firm.id, disposition: "conversation" }, NOW);
    await logCall(handle.db, ctx, { companyId: firm.id, disposition: "do_not_call" }, NOW);
    const [f] = await handle.db.select().from(company).where(eq(company.id, firm.id));
    expect(f!.dncFlag).toBe(true);
    const [d] = await handle.db.select().from(deal).where(eq(deal.companyId, firm.id));
    expect(d!.closedAt).not.toBeNull();
    await expect(
      logCall(handle.db, ctx, { companyId: firm.id, disposition: "no_answer" }, NOW),
    ).rejects.toThrow(/do not call/i);
    expect(await handle.db.select().from(call).where(eq(call.companyId, firm.id))).toHaveLength(2);
  });

  it("refuses a callback in the past", async () => {
    const { ctx, firm } = await setup();
    await expect(
      logCall(
        handle.db,
        ctx,
        { companyId: firm.id, disposition: "callback", nextStepAt: new Date("2026-09-28T10:00:00Z") },
        NOW,
      ),
    ).rejects.toThrow(/past/);
  });
});

describe("recordObjectionHeard", () => {
  it("counts how often an objection comes up", async () => {
    const { ctx, own } = await setup();
    const [o] = await handle.db
      .insert(objection)
      .values({ ...own, title: "Too expensive", response: "…" })
      .returning();
    await recordObjectionHeard(handle.db, ctx, o!.id);
    await recordObjectionHeard(handle.db, ctx, o!.id);
    const [after] = await handle.db.select().from(objection).where(eq(objection.id, o!.id));
    expect(after!.timesHeard).toBe(2);
  });
});
