import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { company, setting } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { logShop, recordReply } from "@/lib/shops/service";
import { shopPlan, shopsOverview } from "@/lib/queries/shops";

const NOW = new Date("2026-09-30T18:00:00Z");
let handle: DbHandle;
let ctx: { userId: string; workspaceId: string };
let firms: { id: string; name: string }[];

beforeAll(async () => {
  handle = await createTestDb();
  const o = await insertOwner(handle.db);
  ctx = { userId: o.userId, workspaceId: o.workspaceId };
  await handle.db.insert(setting).values({ ...o.own, key: "shopperName", value: "Jordan Founder" });
  firms = await handle.db
    .insert(company)
    .values([
      {
        ...o.own,
        name: "Alder Homes",
        normalizedName: "alder",
        score: 90,
        availableRentalsUrl: "https://alder.example/rentals",
      },
      {
        ...o.own,
        name: "Birch Rentals",
        normalizedName: "birch",
        score: 80,
        websiteUrl: "https://birch.example/",
      },
      { ...o.own, name: "Cedar Mgmt", normalizedName: "cedar", score: 70 },
      { ...o.own, name: "Quiet Co", normalizedName: "quiet", score: 95, dncFlag: true },
    ])
    .returning({ id: company.id, name: company.name });
  const a = await logShop(
    handle.db,
    ctx,
    { companyId: firms[0]!.id, channel: "email", sentAt: new Date("2026-09-30T13:00:00Z") },
    NOW,
  );
  await logShop(
    handle.db,
    ctx,
    { companyId: firms[1]!.id, channel: "website_form", sentAt: new Date("2026-09-30T16:30:00Z") },
    NOW,
  );
  await recordReply(
    handle.db,
    ctx,
    a.id,
    { repliedAt: new Date("2026-09-30T14:00:00Z"), replyType: "human" },
    NOW,
  );
  // Logging a shop rescores the firm; pin the scores the ordering tests rely on.
  for (const [i, score] of [90, 80, 70].entries()) {
    await handle.db.update(company).set({ score }).where(eq(company.id, firms[i]!.id));
  }
});
afterAll(async () => {
  await handle.close();
});

describe("shopsOverview", () => {
  it("lists shops with reply minutes, stats by bucket and reply checks due", async () => {
    const o = await shopsOverview(handle.db, ctx.workspaceId, NOW);
    expect(o.shops).toHaveLength(2);
    expect(o.shops.find((s) => s.companyName === "Alder Homes")).toMatchObject({
      replyMinutes: 60,
      replyType: "human",
    });
    expect(o.stats.all).toMatchObject({ count: 2, replied: 1 });
    expect(o.replyChecks).toEqual([
      expect.objectContaining({ companyName: "Birch Rentals", checkpointHours: 1 }),
    ]);
    expect(o.thisWeek).toBe(2);
  });
});

describe("shopPlan", () => {
  it("lists the chosen firms with their rentals link, done state, and never do-not-call firms", async () => {
    const plan = await shopPlan(
      handle.db,
      ctx.workspaceId,
      firms.map((f) => f.id),
      NOW,
    );
    expect(plan.map((p) => p.name)).toEqual(["Alder Homes", "Birch Rentals", "Cedar Mgmt"]);
    expect(plan[0]).toMatchObject({ link: "https://alder.example/rentals", done: true });
    expect(plan[1]).toMatchObject({ link: "https://birch.example/", done: true });
    expect(plan[2]).toMatchObject({ link: null, done: false, nextAllowedAt: null });
  });

  it("defaults to the top new leads by score", async () => {
    const plan = await shopPlan(handle.db, ctx.workspaceId, null, NOW, 2);
    expect(plan.map((p) => p.name)).toEqual(["Alder Homes", "Birch Rentals"]);
  });
});
