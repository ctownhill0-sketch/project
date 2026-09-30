import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import {
  company,
  exclusionRule,
  mysteryShop,
  scoreHistory,
  setting,
  softwarePattern,
  weeklyMetric,
} from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/domain/hours";
import { DEFAULT_WEIGHTS } from "@/lib/domain/scoring";
import {
  addExclusionRule,
  addSoftwarePattern,
  mondayOf,
  saveBusinessHours,
  saveScoringWeights,
  saveWeek,
  setExclusionRuleActive,
  setSoftwarePatternActive,
} from "@/lib/settings/service";

const NOW = new Date("2026-09-29T15:00:00Z");
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
    .values({
      ...o.own,
      name: "Harborline",
      normalizedName: "harborline",
      detectedSoftware: "none",
      isLocal: true,
    })
    .returning();
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, own: o.own, firm: firm! };
}

describe("saveScoringWeights", () => {
  it("saves the weights and rescores every lead with a history row", async () => {
    const { ctx, firm } = await setup();
    const r = await saveScoringWeights(handle.db, ctx, { ...DEFAULT_WEIGHTS, noSoftware: 40 }, NOW);
    expect(r.rescored).toBe(1);
    const [row] = await handle.db.select().from(company).where(eq(company.id, firm.id));
    expect(row!.score).toBeGreaterThan(0);
    const history = await handle.db.select().from(scoreHistory).where(eq(scoreHistory.companyId, firm.id));
    expect(history.at(-1)!.reason).toBe("Scoring weights changed");
    const [saved] = await handle.db
      .select()
      .from(setting)
      .where(and(eq(setting.workspaceId, ctx.workspaceId), eq(setting.key, "scoringWeights")));
    expect(saved!.value).toMatchObject({ noSoftware: 40 });
  });
});

describe("saveBusinessHours", () => {
  it("recomputes every shop's hours bucket", async () => {
    const { ctx, own, firm } = await setup();
    // Tue 29 Sep 2026, 18:30 New York: after hours by default, business hours if the day ends at 19:00.
    await handle.db.insert(mysteryShop).values({
      ...own,
      companyId: firm.id,
      channel: "email",
      sentAt: new Date("2026-09-29T22:30:00Z"),
      hoursBucket: "after_hours",
      shopperName: "Founder",
    });
    const r = await saveBusinessHours(handle.db, ctx, { ...DEFAULT_BUSINESS_HOURS, end: "19:00" });
    expect(r.changed).toBe(1);
    const [shop] = await handle.db.select().from(mysteryShop).where(eq(mysteryShop.companyId, firm.id));
    expect(shop!.hoursBucket).toBe("business");
  });

  it("refuses an end before the start", async () => {
    const { ctx } = await setup();
    await expect(
      saveBusinessHours(handle.db, ctx, { ...DEFAULT_BUSINESS_HOURS, start: "18:00", end: "09:00" }),
    ).rejects.toThrow(/after the start/);
  });
});

describe("saveWeek", () => {
  it("stores a week on its Monday and replaces it on a second save", async () => {
    const { ctx } = await setup();
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
    const week = {
      weekStart: "2026-10-01",
      mrr: 400,
      cash: 1500,
      netBurn: 35,
      paidClients: 1,
      insuranceStudyHours: 3,
      notes: null,
    };
    await saveWeek(handle.db, ctx, week);
    await saveWeek(handle.db, ctx, { ...week, mrr: 800 });
    const rows = await handle.db
      .select()
      .from(weeklyMetric)
      .where(eq(weeklyMetric.workspaceId, ctx.workspaceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weekStart: "2026-09-28", mrr: "800.00" });
  });
});

describe("software patterns and exclusion rules", () => {
  it("adds and turns them off, scoped to the workspace", async () => {
    const { ctx } = await setup();
    const p = await addSoftwarePattern(handle.db, ctx, {
      software: "buildium",
      pattern: "managebuilding.com",
      kind: "domain",
    });
    await setSoftwarePatternActive(handle.db, ctx, p, false);
    const [pattern] = await handle.db.select().from(softwarePattern).where(eq(softwarePattern.id, p));
    expect(pattern!.isActive).toBe(false);

    const e = await addExclusionRule(handle.db, ctx, {
      kind: "chain",
      match: "name",
      pattern: "Megacorp Living",
      category: null,
    });
    await setExclusionRuleActive(handle.db, ctx, e, false);
    const [rule] = await handle.db.select().from(exclusionRule).where(eq(exclusionRule.id, e));
    expect(rule!.isActive).toBe(false);

    const other = await insertOwner(handle.db);
    await expect(
      setExclusionRuleActive(handle.db, { userId: other.userId, workspaceId: other.workspaceId }, e, true),
    ).rejects.toThrow(/not found/);
    await expect(
      addSoftwarePattern(handle.db, ctx, { software: "buildium", pattern: " ", kind: "substring" }),
    ).rejects.toThrow();
  });
});
