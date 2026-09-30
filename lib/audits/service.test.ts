import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createAudit, exportAudit, prepareExport, saveSummary } from "@/lib/audits/service";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, company, fairHousingRule, mysteryShop, roiScenario, vacancyAudit } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { overrideCheck } from "@/lib/compliance/fair-housing";
import { FAIR_HOUSING_RULES } from "@/lib/seed/rules";

const NOW = new Date("2026-09-29T15:00:00Z");
const SENT = new Date("2026-09-15T01:30:00Z");
const GOOD =
  "Your median reply took 14 hours. Renters usually lease from whoever answers first. We can answer every inquiry in under a minute.";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function setup() {
  const o = await insertOwner(handle.db);
  await handle.db.insert(fairHousingRule).values(FAIR_HOUSING_RULES.map((r) => ({ ...o.own, ...r })));
  const firms = await handle.db
    .insert(company)
    .values(
      ["Harborline Residential", "Cobalt Keys", "Linden Row", "Bramble Homes"].map((name) => ({
        ...o.own,
        name,
        normalizedName: name.toLowerCase(),
        metro: "New York metro",
      })),
    )
    .returning();
  const shop = (companyId: string, minutes: number | null, extra = {}) => ({
    ...o.own,
    companyId,
    channel: "email" as const,
    sentAt: SENT,
    hoursBucket: "after_hours" as const,
    firstReplyAt: minutes === null ? null : new Date(SENT.getTime() + minutes * 60_000),
    replyType: minutes === null ? ("none" as const) : ("human" as const),
    shopperName: "Jordan Founder",
    ...extra,
  });
  await handle.db
    .insert(mysteryShop)
    .values([
      shop(firms[0]!.id, 843, { tourOffered: true }),
      shop(firms[1]!.id, 30),
      shop(firms[2]!.id, 45),
      shop(firms[3]!.id, null),
    ]);
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, own: o.own, firm: firms[0]! };
}

describe("createAudit", () => {
  it("freezes the firm's results, an anonymous metro median and default ROI, audited", async () => {
    const { ctx, firm } = await setup();
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    const [row] = await handle.db.select().from(vacancyAudit).where(eq(vacancyAudit.id, id));
    const snap = row!.dataSnapshot as Record<string, unknown>;
    expect(snap).toMatchObject({ firmName: "Harborline Residential", metro: { firms: 4, shops: 4 } });
    expect(JSON.stringify(snap)).not.toMatch(/Cobalt|Linden|Bramble|Jordan/);
    expect((snap.roi as { source: string }).source).toBe("default");
    expect(await handle.db.select().from(auditLog).where(eq(auditLog.entityId, id))).toHaveLength(1);
  });

  it("uses the latest ROI scenario saved for the firm", async () => {
    const { ctx, own, firm } = await setup();
    await handle.db.insert(roiScenario).values({
      ...own,
      companyId: firm.id,
      name: "ROI",
      inputs: { rent: 2400, turnoversPerYear: 10, daysVacant: 20, daysFaster: 5, vacanciesAtOnce: 1 },
      results: {},
    });
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    const [row] = await handle.db.select().from(vacancyAudit).where(eq(vacancyAudit.id, id));
    expect(row!.dataSnapshot).toMatchObject({ roi: { source: "saved", inputs: { rent: 2400 } } });
  });
});

describe("export", () => {
  it("won't check until the summary is ready, then checks and exports", async () => {
    const { ctx, firm } = await setup();
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    await saveSummary(handle.db, ctx, id, "You took 12 hours.");
    expect(await prepareExport(handle.db, ctx, id)).toMatchObject({
      ready: false,
      problems: expect.any(Array),
    });
    await expect(exportAudit(handle.db, ctx, id, NOW)).rejects.toThrow(/Run the checks/);

    await saveSummary(handle.db, ctx, id, GOOD);
    const r = await prepareExport(handle.db, ctx, id);
    expect(r).toMatchObject({ ready: true, check: { outcome: "pass" } });
    const out = await exportAudit(handle.db, ctx, id, NOW);
    expect(out.text).toContain(GOOD);
    const [row] = await handle.db.select().from(vacancyAudit).where(eq(vacancyAudit.id, id));
    expect(row!.pdfGeneratedAt).toEqual(NOW);
    expect(row!.fairHousingCheckId).toBe(r.ready ? r.check.id : null);
  });

  it("a summary edited after the check needs a new check", async () => {
    const { ctx, firm } = await setup();
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    await saveSummary(handle.db, ctx, id, GOOD);
    await prepareExport(handle.db, ctx, id);
    await saveSummary(handle.db, ctx, id, GOOD.replace("first.", "first!"));
    await expect(exportAudit(handle.db, ctx, id, NOW)).rejects.toThrow(/Run the checks/);
  });

  it("blocked wording stops export; a warning exports once overridden", async () => {
    const { ctx, firm } = await setup();
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    await saveSummary(
      handle.db,
      ctx,
      id,
      "Your median reply took 14 hours. No vouchers makes it worse. Let's fix it.",
    );
    expect(await prepareExport(handle.db, ctx, id)).toMatchObject({
      ready: false,
      check: { outcome: "block" },
    });
    await expect(exportAudit(handle.db, ctx, id, NOW)).rejects.toThrow();

    await saveSummary(
      handle.db,
      ctx,
      id,
      "Your median reply took 14 hours. Young professionals move on fast. Let's fix it.",
    );
    const warned = await prepareExport(handle.db, ctx, id);
    expect(warned).toMatchObject({ ready: false, check: { outcome: "warn" } });
    await overrideCheck(
      handle.db,
      ctx,
      warned.check!.id,
      "Describes renter behavior, not a preference.",
      NOW,
    );
    await expect(exportAudit(handle.db, ctx, id, NOW)).resolves.toMatchObject({
      firmName: "Harborline Residential",
    });
  });

  it("changing the summary clears the old check and export; saving the same text keeps them", async () => {
    const { ctx, firm } = await setup();
    const id = await createAudit(handle.db, ctx, firm.id, NOW);
    await saveSummary(handle.db, ctx, id, GOOD);
    await prepareExport(handle.db, ctx, id);
    await exportAudit(handle.db, ctx, id, NOW);
    await saveSummary(handle.db, ctx, id, GOOD);
    let [row] = await handle.db.select().from(vacancyAudit).where(eq(vacancyAudit.id, id));
    expect(row!.pdfGeneratedAt).toEqual(NOW);
    await saveSummary(handle.db, ctx, id, GOOD.replace("first.", "first!"));
    [row] = await handle.db.select().from(vacancyAudit).where(eq(vacancyAudit.id, id));
    expect(row).toMatchObject({ fairHousingCheckId: null, pdfGeneratedAt: null });
  });
});
