import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { call, company, mysteryShop } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { findLocalOwner } from "@/lib/auth/require-user";
import { seed } from "@/lib/seed";
import { getNotifications } from "@/lib/queries/notifications";

const NOW = new Date("2026-09-28T16:00:00Z");
let handle: DbHandle;
let ws: string;
let userId: string;

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now: NOW });
  ({ workspaceId: ws, userId } = await findLocalOwner(handle.db));
});
afterAll(async () => {
  await handle.close();
});

describe("getNotifications", () => {
  it("lists due callbacks and reply checks, newest first, with a total", async () => {
    const [firm] = await handle.db.select().from(company).where(eq(company.workspaceId, ws)).limit(1);
    // A callback due an hour ago and a shop sent 5 hours ago with no reply.
    await handle.db.insert(call).values({
      workspaceId: ws,
      createdById: userId,
      companyId: firm!.id,
      disposition: "callback",
      calledAt: new Date(NOW.getTime() - 86_400_000),
      nextStepAt: new Date(NOW.getTime() - 3_600_000),
    });
    await handle.db.insert(mysteryShop).values({
      workspaceId: ws,
      createdById: userId,
      companyId: firm!.id,
      channel: "email",
      sentAt: new Date(NOW.getTime() - 5 * 3_600_000),
      hoursBucket: "business",
      shopperName: "Demo Shopper",
    });
    const n = await getNotifications(handle.db, ws, NOW);
    expect(n.items.map((i) => i.kind)).toEqual(expect.arrayContaining(["callback", "reply_check"]));
    expect(n.items.find((i) => i.kind === "callback")?.label).toMatch(/Callback overdue/);
    expect(n.items.find((i) => i.kind === "reply_check")?.label).toMatch(/4h reply check/);
    expect(n.total).toBeGreaterThanOrEqual(2);
    expect(
      n.items
        .filter((i) => i.kind === "callback" || i.kind === "reply_check")
        .every((i) => i.href.startsWith("/leads?lead=")),
    ).toBe(true);
  });

  it("adds call-now leads: a shop unanswered for 24h and no call since", async () => {
    const [, , , firm] = await handle.db.select().from(company).where(eq(company.workspaceId, ws)).limit(4);
    await handle.db.update(company).set({ dncFlag: false, status: "new" }).where(eq(company.id, firm!.id));
    await handle.db.insert(mysteryShop).values({
      workspaceId: ws,
      createdById: userId,
      companyId: firm!.id,
      channel: "email",
      sentAt: new Date(NOW.getTime() - 30 * 3_600_000),
      hoursBucket: "after_hours",
      shopperName: "Demo Shopper",
    });
    const n = await getNotifications(handle.db, ws, NOW);
    const item = n.items.find((i) => i.kind === "call_now" && i.name === firm!.name);
    expect(item).toMatchObject({
      href: `/calls?lead=${firm!.id}`,
      label: expect.stringMatching(/No reply in 24h/),
    });
  });

  it("adds finder results waiting for triage and pilots at risk", async () => {
    const n = await getNotifications(handle.db, ws, NOW);
    const kinds = n.items.map((i) => i.kind);
    expect(kinds).toContain("pilot_at_risk");
    expect(n.items.find((i) => i.kind === "pilot_at_risk")!.href).toBe("/pilots");
    if (kinds.includes("finder"))
      expect(n.items.find((i) => i.kind === "finder")!.href).toBe("/finder/triage");
  });
});
