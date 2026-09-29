import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { company, contact, mysteryShop, pipelineStage, script, setting } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { PIPELINE_STAGES } from "@/lib/seed";
import { logCall } from "@/lib/calls/service";
import { callList, callPrep, callStats } from "@/lib/queries/calls";

const NOW = new Date("2026-09-30T14:00:00Z");
let handle: DbHandle;
let ctx: { userId: string; workspaceId: string };
let ids: Record<string, string>;

beforeAll(async () => {
  handle = await createTestDb();
  const o = await insertOwner(handle.db);
  ctx = { userId: o.userId, workspaceId: o.workspaceId };
  await handle.db
    .insert(pipelineStage)
    .values(PIPELINE_STAGES.map((st, i) => ({ ...o.own, ...st, position: i + 1 })));
  await handle.db.insert(setting).values({ ...o.own, key: "shopperName", value: "Jordan Founder" });
  await handle.db.insert(script).values([
    {
      ...o.own,
      kind: "opener_with_result",
      name: "Opener",
      body: "Hi {{contactName}}, {{founderName}} here. Your reply took {{replyTime}} on {{shopDate}}.",
    },
  ]);
  const rows = await handle.db
    .insert(company)
    .values([
      { ...o.own, name: "Hot Firm", normalizedName: "hot", phone: "(201) 555-0101", score: 40 },
      { ...o.own, name: "Top Firm", normalizedName: "top", phone: "(201) 555-0102", score: 90 },
      { ...o.own, name: "Called Firm", normalizedName: "called", phone: "(201) 555-0103", score: 95 },
      { ...o.own, name: "Silent Firm", normalizedName: "silent", phone: null, score: 99 },
    ])
    .returning({ id: company.id, name: company.name });
  ids = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  await handle.db
    .insert(contact)
    .values({ ...o.own, companyId: ids["Hot Firm"]!, name: "Sam Rivera", isDecisionMaker: true });
  await handle.db.insert(mysteryShop).values({
    ...o.own,
    companyId: ids["Hot Firm"]!,
    channel: "email",
    sentAt: new Date("2026-09-28T02:00:00Z"),
    hoursBucket: "after_hours",
    shopperName: "Jordan Founder",
  });
  await logCall(
    handle.db,
    ctx,
    { companyId: ids["Called Firm"]!, disposition: "conversation", isDecisionMakerConversation: true },
    new Date("2026-09-30T13:00:00Z"),
  );
});
afterAll(async () => {
  await handle.close();
});

describe("callList", () => {
  it("puts fresh no-reply shops first, then score; skips firms just called or without a phone", async () => {
    const list = await callList(handle.db, ctx.workspaceId, NOW);
    expect(list.map((i) => i.name)).toEqual(["Hot Firm", "Top Firm"]);
    expect(list[0]).toMatchObject({ kind: "call_now", phone: "(201) 555-0101" });
  });
});

describe("callPrep", () => {
  it("fills scripts from the firm's own data and flags what's unknown", async () => {
    const prep = await callPrep(handle.db, ctx.workspaceId, ids["Hot Firm"]!, NOW);
    const opener = prep!.scripts.find((s) => s.kind === "opener_with_result")!;
    expect(opener.filled.text).toBe(
      "Hi Sam Rivera, Jordan Founder here. Your reply took no reply after 2d 12h on Sep 27.",
    );
    expect(opener.filled.missing).toEqual([]);
    expect(prep!.lead.name).toBe("Hot Firm");
  });

  it("marks missing values when there is no shop or contact", async () => {
    const prep = await callPrep(handle.db, ctx.workspaceId, ids["Top Firm"]!, NOW);
    expect(prep!.scripts[0]!.filled.missing).toEqual(["contactName", "replyTime", "shopDate"]);
  });
});

describe("callStats", () => {
  it("counts calls today and decision-maker conversations this week", async () => {
    expect(await callStats(handle.db, ctx.workspaceId, NOW)).toMatchObject({
      today: 1,
      conversationsThisWeek: 1,
      callbacksDue: 0,
    });
  });
});
