import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { findLocalOwner } from "@/lib/auth/require-user";
import { seed } from "@/lib/seed";
import { getDashboard } from "@/lib/queries/dashboard";
import { getLeadDetail, leadCounts, listLeads, searchLeads } from "@/lib/queries/leads";

const NOW = new Date("2026-09-28T16:00:00Z");
let handle: DbHandle;
let ws: string;

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now: NOW });
  ws = (await findLocalOwner(handle.db)).workspaceId;
});
afterAll(async () => {
  await handle.close();
});

describe("getDashboard", () => {
  it("returns header numbers from real data", async () => {
    const d = await getDashboard(handle.db, ws, NOW);
    expect(d.mrr).toBe(400);
    expect(d.wow).toBe(0);
    expect(d.killTest).toMatchObject({ started: false, startsInDays: 1, pilots: 2 });
    expect(d.killTest.afterHoursMedianMinutes).not.toBeNull();
    expect(d.callsThisWeek).toBeGreaterThanOrEqual(0);
  });

  it("builds today's list with a callable Next up and a why line", async () => {
    const d = await getDashboard(handle.db, ws, NOW);
    expect(d.today.items.length).toBeGreaterThan(0);
    expect(d.nextUp).not.toBeNull();
    expect(d.nextUp?.why.length).toBeGreaterThan(5);
    // Never suggests an excluded (AppFolio) firm.
    const names = new Set((await listLeads(handle.db, ws, { status: "excluded" })).map((l) => l.id));
    expect(d.today.items.some((i) => names.has(i.companyId))).toBe(false);
  });

  it("returns the MRR series and a 7% projection from the latest week", async () => {
    const d = await getDashboard(handle.db, ws, NOW);
    expect(d.mrrSeries).toHaveLength(12);
    expect(d.projection[0]?.mrr).toBe(400);
    expect(Math.round(d.projection[1]?.mrr ?? 0)).toBe(428);
  });
});

describe("leads queries", () => {
  it("lists leads by score with a why line and the effective software", async () => {
    const leads = await listLeads(handle.db, ws, {});
    expect(leads).toHaveLength(50);
    expect(leads[0]!.score).toBeGreaterThanOrEqual(leads[1]!.score);
    expect(leads.every((l) => l.why.length > 0)).toBe(true);
  });

  it("filters by status and software", async () => {
    const excluded = await listLeads(handle.db, ws, { status: "excluded" });
    expect(excluded).toHaveLength(5);
    const buildium = await listLeads(handle.db, ws, { software: "buildium" });
    expect(buildium.every((l) => l.software === "buildium")).toBe(true);
  });

  it("counts totals, ready, excluded and possible duplicates", async () => {
    const c = await leadCounts(handle.db, ws);
    expect(c).toMatchObject({ total: 50, excluded: 5 });
    expect(c.possibleDuplicates).toBeGreaterThanOrEqual(3);
    expect(c.ready).toBeGreaterThan(0);
  });

  it("returns lead detail scoped to the workspace", async () => {
    const [first] = await listLeads(handle.db, ws, {});
    const detail = await getLeadDetail(handle.db, ws, first!.id);
    expect(detail?.name).toBe(first!.name);
    expect(detail?.breakdown.length).toBeGreaterThan(0);
    expect(await getLeadDetail(handle.db, "00000000-0000-0000-0000-000000000000", first!.id)).toBeNull();
  });

  it("searches by name, town or phone", async () => {
    const [first] = await listLeads(handle.db, ws, {});
    const byName = await searchLeads(handle.db, ws, first!.name.split(" ")[0]!);
    expect(byName.some((l) => l.id === first!.id)).toBe(true);
    const byPhone = await searchLeads(handle.db, ws, first!.phone!.slice(-4));
    expect(byPhone.some((l) => l.id === first!.id)).toBe(true);
    expect(await searchLeads(handle.db, ws, "")).toEqual([]);
  });
});
