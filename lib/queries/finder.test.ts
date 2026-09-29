import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { exclusionRule, softwarePattern } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { DEFAULT_EXCLUSION_RULES } from "@/lib/domain/exclusion";
import { DEFAULT_SOFTWARE_PATTERNS } from "@/lib/domain/software";
import { fixturePageSource } from "@/lib/finder/fixture-sites";
import { fixtureTransport } from "@/lib/finder/fixture-transport";
import { createPlacesClient } from "@/lib/finder/places";
import { createSearchRun, enrichPending, runNextQuery, triagePlace } from "@/lib/finder/service";
import { finderOverview, listPlaces, placeDetail, triageQueue, usageReport } from "@/lib/queries/finder";

const NOW = new Date("2026-09-29T14:00:00Z");
let handle: DbHandle;
let ctx: { userId: string; workspaceId: string };
let runId: string;

beforeAll(async () => {
  handle = await createTestDb();
  const owner = await insertOwner(handle.db);
  ctx = { userId: owner.userId, workspaceId: owner.workspaceId };
  await handle.db
    .insert(softwarePattern)
    .values(DEFAULT_SOFTWARE_PATTERNS.map((p) => ({ ...owner.own, ...p })));
  await handle.db.insert(exclusionRule).values(DEFAULT_EXCLUSION_RULES.map((r) => ({ ...owner.own, ...r })));
  const client = createPlacesClient({ apiKey: "k", transport: fixtureTransport() });
  const run = await createSearchRun(
    handle.db,
    ctx,
    { towns: [{ town: "Jersey City", state: "NJ" }], keywords: ["pm"] },
    NOW,
  );
  runId = run.id;
  for (let i = 0; i < 5; i += 1) if ((await runNextQuery(handle.db, ctx, run.id, client, NOW)).done) break;
  await enrichPending(handle.db, ctx, run.id, fixturePageSource(), { limit: 30 }, NOW);
});
afterAll(async () => {
  await handle.close();
});

describe("finder queries", () => {
  it("lists a run's places with enrichment facts, best score first", async () => {
    const rows = await listPlaces(handle.db, ctx.workspaceId, { runId });
    expect(rows).toHaveLength(22);
    expect(rows[0]!.score).toBeGreaterThanOrEqual(rows[1]!.score);
    const enriched = rows.find((r) => r.enrichmentStatus === "done")!;
    expect(enriched).toMatchObject({ software: expect.any(String), units: expect.any(Number) });
    expect(rows.find((r) => r.name === "The Larkspur Apartments")).toMatchObject({ fitStatus: "not_a_fit" });
  });

  it("filters by triage and fit", async () => {
    expect(
      (await listPlaces(handle.db, ctx.workspaceId, { runId, filter: "not_a_fit" })).every(
        (r) => r.fitStatus !== "ok" || r.triageStatus === "not_a_fit",
      ),
    ).toBe(true);
    const pending = await listPlaces(handle.db, ctx.workspaceId, { runId, filter: "pending" });
    expect(pending.every((r) => r.triageStatus === "pending")).toBe(true);
  });

  it("queues pending, addable places for triage by score", async () => {
    const queue = await triageQueue(handle.db, ctx.workspaceId, runId);
    expect(queue.length).toBeGreaterThan(10);
    expect(
      queue.every(
        (q) => q.triageStatus === "pending" && q.dedupeStatus !== "dnc" && q.dedupeStatus !== "duplicate",
      ),
    ).toBe(true);
    expect(queue[0]!.score).toBeGreaterThanOrEqual(queue.at(-1)!.score);
  });

  it("shows a place's evidence with sources", async () => {
    const [first] = await listPlaces(handle.db, ctx.workspaceId, { runId, filter: "pending" });
    const d = await placeDetail(handle.db, ctx.workspaceId, first!.id);
    expect(d?.place.placeId).toMatch(/^fx-/);
    expect(d?.enrichmentRuns.length).toBeGreaterThanOrEqual(0);
    expect(await placeDetail(handle.db, "00000000-0000-0000-0000-000000000000", first!.id)).toBeNull();
  });

  it("summarizes usage and the overview", async () => {
    const [first] = await triageQueue(handle.db, ctx.workspaceId, runId);
    await triagePlace(handle.db, ctx, first!.id, "add", NOW);
    const o = await finderOverview(handle.db, ctx.workspaceId, NOW);
    expect(o.usage.search).toEqual({ today: 2, month: 2 });
    expect(o.caps.search).toEqual({ daily: 100, monthly: 900 });
    expect(o.addedThisWeek).toBe(1);
    expect(o.pendingTriage).toBeGreaterThan(10);
    expect(o.runs[0]).toMatchObject({ id: runId, status: "done" });

    const u = await usageReport(handle.db, ctx.workspaceId, NOW);
    expect(u.days[0]).toMatchObject({ date: "2026-09-29", search: 2, details: 0 });
    expect(u.month).toMatchObject({ search: 2, costAfterFreeUsd: 0 });
    expect(u.listCostUsd).toBeCloseTo(0.07);
    expect(u.runs[0]).toMatchObject({ runId, requests: 2 });
  });
});
