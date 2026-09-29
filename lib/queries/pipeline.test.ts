import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { company, pipelineStage } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { PIPELINE_STAGES } from "@/lib/seed";
import { moveDeal, openDeal } from "@/lib/pipeline/service";
import { pipelineBoard } from "@/lib/queries/pipeline";

const T0 = new Date("2026-09-20T14:00:00Z");
const NOW = new Date("2026-09-29T14:00:00Z");
let handle: DbHandle;
let ctx: { userId: string; workspaceId: string };

beforeAll(async () => {
  handle = await createTestDb();
  const o = await insertOwner(handle.db);
  ctx = { userId: o.userId, workspaceId: o.workspaceId };
  await handle.db
    .insert(pipelineStage)
    .values(PIPELINE_STAGES.map((st, i) => ({ ...o.own, ...st, position: i + 1 })));
  const firms = await handle.db
    .insert(company)
    .values([
      { ...o.own, name: "Alder", normalizedName: "alder" },
      { ...o.own, name: "Birch", normalizedName: "birch" },
      { ...o.own, name: "Cedar", normalizedName: "cedar" },
    ])
    .returning();
  const a = await openDeal(handle.db, ctx, firms[0]!.id, "new", T0);
  await moveDeal(handle.db, ctx, a.id, "pilot_live", {}, new Date("2026-09-25T14:00:00Z"));
  await openDeal(handle.db, ctx, firms[1]!.id, "conversation", T0);
  const c = await openDeal(handle.db, ctx, firms[2]!.id, "new", T0);
  await moveDeal(handle.db, ctx, c.id, "lost", { lostReason: "Too small" }, NOW);
});
afterAll(async () => {
  await handle.close();
});

describe("pipelineBoard", () => {
  it("groups deals by stage with days in stage, history and totals", async () => {
    const b = await pipelineBoard(handle.db, ctx.workspaceId, NOW);
    expect(b.stages.map((s) => s.key)).toEqual(PIPELINE_STAGES.map((s) => s.key));
    const live = b.stages.find((s) => s.key === "pilot_live")!;
    expect(live.deals).toHaveLength(1);
    expect(live.deals[0]).toMatchObject({ companyName: "Alder", daysInStage: 4, expectedMrr: 300 });
    expect(live.deals[0]!.history.map((h) => h.to)).toEqual(["New", "Pilot live"]);
    expect(b.stages.find((s) => s.key === "lost")!.deals[0]).toMatchObject({
      companyName: "Cedar",
      lostReason: "Too small",
    });
    // Open deals: Alder 400×75% + Birch 400×25%
    expect(b.totals).toMatchObject({ open: 2, expectedMrr: 400, lostThisMonth: 1 });
  });
});
