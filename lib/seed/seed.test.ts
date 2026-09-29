import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq, isNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DbHandle } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { SEED_OWNER_EMAIL, seed } from "@/lib/seed";

const REFERENCE = new Date("2026-09-28T16:00:00Z");
let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now: REFERENCE });
});
afterAll(async () => {
  await handle.close();
});

const total = async (table: PgTable) => (await handle.db.select({ n: count() }).from(table))[0]?.n;

describe("seed", () => {
  it("creates one workspace, one owner and one membership", async () => {
    expect(await total(s.workspace)).toBe(1);
    expect(await total(s.membership)).toBe(1);
    const users = await handle.db.select().from(s.appUser);
    expect(users.map((u) => u.email)).toEqual([SEED_OWNER_EMAIL]);
    expect(SEED_OWNER_EMAIL).toMatch(/\.example$/); // no real personal data in seed
  });

  it("creates 50 fictional NYC-metro firms: 5 on AppFolio, 5 duplicates", async () => {
    const firms = await handle.db.select().from(s.company);
    expect(firms).toHaveLength(50);
    expect(firms.filter((f) => f.detectedSoftware === "appfolio")).toHaveLength(5);
    for (const firm of firms) {
      expect(firm.domain ?? "x.example").toMatch(/\.example$/);
      expect(firm.phone ?? "+12125550100").toMatch(/^\+1\d{3}55501\d{2}$/);
    }
    const byDomain = new Map<string, number>();
    for (const f of firms)
      if (f.normalizedDomain) byDomain.set(f.normalizedDomain, (byDomain.get(f.normalizedDomain) ?? 0) + 1);
    expect([...byDomain.values()].filter((n) => n === 2)).toHaveLength(3); // same-domain duplicates
    expect(firms.filter((f) => f.metro === "New York metro").length).toBeGreaterThanOrEqual(45);
  });

  it("creates 40 mystery shops, 8 with no reply, in every hours bucket", async () => {
    const shops = await handle.db.select().from(s.mysteryShop);
    expect(shops).toHaveLength(40);
    expect(shops.filter((x) => x.firstReplyAt === null)).toHaveLength(8);
    expect(new Set(shops.map((x) => x.hoursBucket))).toEqual(
      new Set(["business", "saturday", "after_hours"]),
    );
    const nearDst = shops.filter(
      (x) => Math.abs(x.sentAt.getTime() - Date.parse("2026-03-08T07:00:00Z")) < 3 * 86_400_000,
    );
    expect(nearDst.length).toBeGreaterThanOrEqual(2);
  });

  it("never shops a firm twice within 30 days (ethics rule)", async () => {
    const shops = await handle.db.select().from(s.mysteryShop);
    const byFirm = new Map<string, number[]>();
    for (const x of shops) byFirm.set(x.companyId, [...(byFirm.get(x.companyId) ?? []), x.sentAt.getTime()]);
    for (const times of byFirm.values()) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i += 1)
        expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(30 * 86_400_000);
    }
  });

  it("creates 25 calls, 12 deals, 10 pipeline stages and at most one open deal per firm", async () => {
    expect(await total(s.call)).toBe(25);
    expect(await total(s.deal)).toBe(12);
    expect(await total(s.pipelineStage)).toBe(10);
    const open = await handle.db
      .select({ companyId: s.deal.companyId, n: count() })
      .from(s.deal)
      .where(isNull(s.deal.closedAt))
      .groupBy(s.deal.companyId);
    expect(open.every((r) => r.n === 1)).toBe(true);
  });

  it("creates 2 pilots on day 7: one on track, one at risk", async () => {
    const pilots = await handle.db.select().from(s.pilot);
    expect(pilots).toHaveLength(2);
    for (const p of pilots) expect(p.day0).toBe("2026-09-21");
    const tours = await handle.db
      .select({ pilotId: s.pilotMetric.pilotId, tours: sql<number>`sum(${s.pilotMetric.tours})::int` })
      .from(s.pilotMetric)
      .groupBy(s.pilotMetric.pilotId);
    // projected = tours × 14 ÷ 7; target 5 → on track needs ≥ 3 tours by day 7.
    expect(tours.map((t) => t.tours >= 3).sort()).toEqual([false, true]);
  });

  it("creates 12 weeks of metrics and the default settings", async () => {
    expect(await total(s.weeklyMetric)).toBe(12);
    const settings = Object.fromEntries(
      (await handle.db.select().from(s.setting)).map((r) => [r.key, r.value]),
    );
    expect(settings["killTest"]).toMatchObject({
      day0: "2026-09-29",
      deadline: "2026-12-28",
      pilotsTarget: 3,
      conversationsTarget: 60,
      afterHoursMedianMinutes: 10,
    });
    expect(settings["businessHours"]).toMatchObject({ timeZone: "America/New_York", saturdayBucket: true });
    expect(settings["scoringWeights"]).toMatchObject({
      notAppfolio: 30,
      noSoftware: 20,
      listings3to25: 20,
      slowReply: 25,
      units50to500: 15,
      local: 10,
    });
    expect(settings["guarantee"]).toMatchObject({ tourTarget: 5, medianReplySeconds: 60 });
  });

  it("seeds the software patterns and fair-housing rules", async () => {
    const patterns = await handle.db.select().from(s.softwarePattern);
    expect(patterns.map((p) => p.pattern).sort()).toEqual(
      [
        "appfolio.com",
        "buildium.com",
        "doorloop.com",
        "managebuilding.com",
        "rentcafe",
        "rentmanager",
        "rmresident",
        "securecafe",
        "yardibreeze",
        "propertyware.com",
        "rentvine.com",
        "tenantcloud.com",
      ].sort(),
    );
    const exclusions = await handle.db.select().from(s.exclusionRule);
    expect(exclusions.some((r) => r.kind === "chain" && r.pattern === "Greystar")).toBe(true);
    expect(exclusions.some((r) => r.kind === "not_a_fit" && r.category === "hoa")).toBe(true);
    const rules = await handle.db.select().from(s.fairHousingRule);
    expect(rules.length).toBeGreaterThanOrEqual(8);
    expect(rules.some((r) => r.category === "source_of_income")).toBe(true);
  });

  it("is idempotent", async () => {
    await seed(handle.db, { now: REFERENCE });
    expect(await total(s.company)).toBe(50);
    expect(await total(s.workspace)).toBe(1);
    const owner = await handle.db.select().from(s.appUser).where(eq(s.appUser.email, SEED_OWNER_EMAIL));
    expect(owner).toHaveLength(1);
  });

  it("scores every firm with the real scoring rules and records score history", async () => {
    const firms = await handle.db.select().from(s.company);
    const appfolio = firms.filter((f) => f.detectedSoftware === "appfolio");
    expect(appfolio.every((f) => f.score === 0)).toBe(true);
    const scored = firms.filter((f) => f.detectedSoftware !== "appfolio");
    expect(scored.every((f) => f.score > 0 && f.score <= 100)).toBe(true);
    expect(scored.every((f) => f.scoreBreakdown.length > 0)).toBe(true);
    expect(await total(s.scoreHistory)).toBe(firms.length);
  });
});
