import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, client, company, pilot, pilotMetric, vacancy } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { closePilot, listPilots, saveDayMetrics, startPilot } from "@/lib/pilots/service";
import { saveSetting } from "@/lib/settings/save";

const TODAY = "2026-09-29";
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

const row = (vacancyId: string, extra: Partial<Record<string, number | null>> = {}) => ({
  vacancyId,
  inquiries: 4,
  medianReplySeconds: 40,
  p90ReplySeconds: 80,
  tours: 1,
  applications: 0,
  escalations: 0,
  fairHousingFlags: 0,
  humanMinutes: 10,
  ...extra,
});

describe("startPilot", () => {
  it("creates the client, the pilot and its vacancies, audited", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: TODAY,
      vacancies: [
        { label: "Unit 1A", baselineDaysOnMarket: 34 },
        { label: "Unit 2B", baselineDaysOnMarket: null },
      ],
    });
    const [p] = await handle.db.select().from(pilot).where(eq(pilot.id, id));
    expect(p).toMatchObject({ day0: TODAY, status: "running", tourTarget: 5 });
    const [c] = await handle.db.select().from(client).where(eq(client.id, p!.clientId));
    expect(c).toMatchObject({ companyId: firm.id, status: "pilot" });
    expect(await handle.db.select().from(vacancy).where(eq(vacancy.clientId, c!.id))).toHaveLength(2);
    expect(await handle.db.select().from(auditLog).where(eq(auditLog.entityId, id))).toHaveLength(1);
  });

  it("refuses a firm that already has a running pilot", async () => {
    const { ctx, firm } = await setup();
    const input = {
      companyId: firm.id,
      day0: TODAY,
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    };
    await startPilot(handle.db, ctx, input);
    await expect(startPilot(handle.db, ctx, input)).rejects.toThrow(/already has a running pilot/);
  });
});

describe("saveDayMetrics", () => {
  it("upserts one row per vacancy per day and feeds the guarantee", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-22",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    const [pv] = (await listPilots(handle.db, ctx.workspaceId, TODAY))[0]!.vacancies;
    await saveDayMetrics(handle.db, ctx, { pilotId: id, day: "2026-09-22", rows: [row(pv!.id)] }, TODAY);
    await saveDayMetrics(
      handle.db,
      ctx,
      { pilotId: id, day: "2026-09-22", rows: [row(pv!.id, { tours: 2 })] },
      TODAY,
    );
    const rows = await handle.db.select().from(pilotMetric).where(eq(pilotMetric.pilotId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tours).toBe(2);
    const [listed] = await listPilots(handle.db, ctx.workspaceId, TODAY);
    expect(listed).toMatchObject({ elapsed: 7, day: 7 });
    expect(listed!.vacancies[0]!.guarantee).toMatchObject({ status: "at_risk", tours: 2, projectedTours: 4 });
  });

  it("refuses days outside the pilot, future days, other pilots' vacancies and bad numbers", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-22",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    const [pv] = (await listPilots(handle.db, ctx.workspaceId, TODAY)).find((p) => p.id === id)!.vacancies;
    const save = (day: string, r = row(pv!.id)) =>
      saveDayMetrics(handle.db, ctx, { pilotId: id, day, rows: [r] }, TODAY);
    await expect(save("2026-09-21")).rejects.toThrow(/between/);
    await expect(save("2026-09-30")).rejects.toThrow(/future/);
    await expect(save("2026-09-23", row("00000000-0000-4000-8000-000000000000"))).rejects.toThrow(/vacancy/);
    await expect(save("2026-09-23", row(pv!.id, { tours: -1 }))).rejects.toThrow();
  });
});

describe("closePilot", () => {
  it("only closes from day 14, as met or missed", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-15",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    await expect(closePilot(handle.db, ctx, id, "2026-09-28")).rejects.toThrow(/day 14/);
    expect(await closePilot(handle.db, ctx, id, TODAY)).toBe("missed");
    const [p] = await handle.db.select().from(pilot).where(eq(pilot.id, id));
    expect(p!.status).toBe("missed");
  });
});

describe("pilot isolation and frozen rules", () => {
  it("a firm's second pilot has only its own vacancies", async () => {
    const { ctx, firm } = await setup();
    const first = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-01",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    await closePilot(handle.db, ctx, first, TODAY);
    const second = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-28",
      vacancies: [{ label: "Unit 2B", baselineDaysOnMarket: null }],
    });
    const pilots = await listPilots(handle.db, ctx.workspaceId, TODAY);
    const one = pilots.find((p) => p.id === first)!;
    const two = pilots.find((p) => p.id === second)!;
    expect(one.vacancies.map((v) => v.label)).toEqual(["Unit 1A"]);
    expect(two.vacancies.map((v) => v.label)).toEqual(["Unit 2B"]);
    await expect(
      saveDayMetrics(
        handle.db,
        ctx,
        { pilotId: second, day: TODAY, rows: [row(one.vacancies[0]!.id)] },
        TODAY,
      ),
    ).rejects.toThrow(/vacancy/);
  });

  it("keeps the rules a pilot started with when settings change", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-20",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    await saveSetting(handle.db, ctx, "guarantee", {
      tourTarget: 9,
      medianReplySeconds: 30,
      atRiskFromDay: 3,
      pilotDays: 7,
    });
    const p = (await listPilots(handle.db, ctx.workspaceId, TODAY)).find((x) => x.id === id)!;
    expect(p.rules).toMatchObject({ tourTarget: 5, medianReplySeconds: 60, atRiskFromDay: 7, pilotDays: 14 });
    expect(p.lastDay).toBe("2026-10-03");
  });

  it("projects over today's entry once it's in", async () => {
    const { ctx, firm } = await setup();
    const id = await startPilot(handle.db, ctx, {
      companyId: firm.id,
      day0: "2026-09-22",
      vacancies: [{ label: "Unit 1A", baselineDaysOnMarket: null }],
    });
    const [v] = (await listPilots(handle.db, ctx.workspaceId, TODAY)).find((x) => x.id === id)!.vacancies;
    await saveDayMetrics(
      handle.db,
      ctx,
      { pilotId: id, day: "2026-09-22", rows: [row(v!.id, { tours: 4 })] },
      TODAY,
    );
    await saveDayMetrics(
      handle.db,
      ctx,
      { pilotId: id, day: TODAY, rows: [row(v!.id, { tours: 0 })] },
      TODAY,
    );
    const p = (await listPilots(handle.db, ctx.workspaceId, TODAY)).find((x) => x.id === id)!;
    expect(p.vacancies[0]!.guarantee.projectedTours).toBe(7); // 4 × 14 ÷ 8 days of data
  });
});
