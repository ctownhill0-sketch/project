import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, company, mysteryShop, setting } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { logShop, recordReply } from "@/lib/shops/service";

// Tue 29 Sep 2026, 22:00 in New York (after hours).
const NOW = new Date("2026-09-30T02:00:00Z");
let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function setup(extra: Partial<typeof company.$inferInsert> = {}) {
  const o = await insertOwner(handle.db);
  const [firm] = await handle.db
    .insert(company)
    .values({
      ...o.own,
      name: "Harborline Residential",
      normalizedName: "harborline",
      isLocal: true,
      detectedSoftware: "buildium",
      ...extra,
    })
    .returning();
  await handle.db.insert(setting).values({ ...o.own, key: "shopperName", value: "Jordan Founder" });
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, firm: firm! };
}

describe("logShop", () => {
  it("records the shop with the founder's name and the NY hours bucket, audited", async () => {
    const { ctx, firm } = await setup();
    const shop = await logShop(handle.db, ctx, { companyId: firm.id, channel: "email", sentAt: NOW }, NOW);
    expect(shop).toMatchObject({
      hoursBucket: "after_hours",
      shopperName: "Jordan Founder",
      firstReplyAt: null,
    });
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.workspaceId, ctx.workspaceId));
    expect(audits.some((a) => a.entity === "mystery_shop" && a.action === "create")).toBe(true);
    expect(JSON.stringify(audits)).not.toContain("Jordan Founder");
  });

  it("buckets a Saturday inquiry as Saturday", async () => {
    const { ctx, firm } = await setup();
    const sat = new Date("2026-10-03T15:00:00Z");
    const shop = await logShop(
      handle.db,
      ctx,
      { companyId: firm.id, channel: "website_form", sentAt: sat },
      new Date("2026-10-03T16:00:00Z"),
    );
    expect(shop.hoursBucket).toBe("saturday");
  });

  it("allows one shop per firm per 30 days", async () => {
    const { ctx, firm } = await setup();
    await logShop(handle.db, ctx, { companyId: firm.id, channel: "email", sentAt: NOW }, NOW);
    await expect(
      logShop(handle.db, ctx, { companyId: firm.id, channel: "phone", sentAt: NOW }, NOW),
    ).rejects.toThrow(/30 days/);
  });

  it("refuses future times and do-not-call firms", async () => {
    const { ctx, firm } = await setup();
    await expect(
      logShop(
        handle.db,
        ctx,
        { companyId: firm.id, channel: "email", sentAt: new Date(NOW.getTime() + 3600_000) },
        NOW,
      ),
    ).rejects.toThrow(/future/);
    const dnc = await setup({ name: "Quiet Co", dncFlag: true });
    await expect(
      logShop(handle.db, dnc.ctx, { companyId: dnc.firm.id, channel: "email", sentAt: NOW }, NOW),
    ).rejects.toThrow(/do not call/i);
  });
});

describe("recordReply", () => {
  it("'Replied now' sets the reply time and rescoring uses it", async () => {
    const { ctx, firm } = await setup();
    const sent = new Date("2026-09-29T14:00:00Z");
    const shop = await logShop(handle.db, ctx, { companyId: firm.id, channel: "email", sentAt: sent }, sent);
    const later = new Date("2026-09-29T19:00:00Z"); // 5h: slower than 2h
    await recordReply(handle.db, ctx, shop.id, { repliedAt: later, replyType: "human" }, later);
    const [s] = await handle.db.select().from(mysteryShop).where(eq(mysteryShop.id, shop.id));
    expect(s).toMatchObject({ replyType: "human" });
    expect(s!.firstReplyAt!.toISOString()).toBe(later.toISOString());
    expect(s!.firstHumanReplyAt!.toISOString()).toBe(later.toISOString());
    const [f] = await handle.db.select().from(company).where(eq(company.id, firm.id));
    expect(f!.scoreBreakdown.some((b) => b.rule === "slowReply")).toBe(true);
  });

  it("rejects a reply time before the inquiry", async () => {
    const { ctx, firm } = await setup();
    const shop = await logShop(handle.db, ctx, { companyId: firm.id, channel: "email", sentAt: NOW }, NOW);
    await expect(
      recordReply(
        handle.db,
        ctx,
        shop.id,
        { repliedAt: new Date(NOW.getTime() - 60_000), replyType: "auto" },
        NOW,
      ),
    ).rejects.toThrow(/before/);
  });
});
