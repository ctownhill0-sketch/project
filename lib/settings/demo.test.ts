import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, like, not, sql } from "drizzle-orm";
import { findLocalOwner } from "@/lib/auth/require-user";
import type { DbHandle } from "@/lib/db/client";
import {
  auditLog,
  call,
  company,
  fairHousingRule,
  mysteryShop,
  pilot,
  script,
  setting,
  weeklyMetric,
} from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { seed } from "@/lib/seed";
import { DEMO_REFERENCES, deleteDemoData, demoDataCounts } from "@/lib/settings/demo";

const NOW = new Date("2026-09-29T15:00:00Z");
let handle: DbHandle;
let ctx: { userId: string; workspaceId: string };

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now: NOW });
  ctx = await findLocalOwner(handle.db);
});
afterAll(async () => {
  await handle.close();
});

describe("DEMO_REFERENCES", () => {
  it("covers every table that points at a company, client, deal, pilot or vacancy", async () => {
    const result = await handle.db.execute(
      sql`select table_name, column_name from information_schema.columns
          where table_schema = 'public'
            and column_name in ('company_id', 'dedupe_company_id', 'client_id', 'deal_id', 'pilot_id', 'vacancy_id')`,
    );
    const rows = ((result as { rows?: unknown[] }).rows ?? result) as {
      table_name: string;
      column_name: string;
    }[];
    const handled = new Set(DEMO_REFERENCES.map((r) => `${r.table}.${r.column}`));
    const missing = rows.map((r) => `${r.table_name}.${r.column_name}`).filter((k) => !handled.has(k));
    expect(missing).toEqual([]);
  });
});

describe("deleteDemoData", () => {
  it("removes the fictional firms and everything attached, and keeps real data and setup", async () => {
    const [real] = await handle.db
      .insert(company)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        name: "Real Firm LLC",
        normalizedName: "real firm",
        domain: "realfirm.com",
        normalizedDomain: "realfirm.com",
      })
      .returning();
    await handle.db.insert(mysteryShop).values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      companyId: real!.id,
      channel: "email",
      sentAt: NOW,
      hoursBucket: "business",
      shopperName: "Founder",
    });
    await handle.db.insert(weeklyMetric).values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      weekStart: "2027-01-04",
      mrr: "400.00",
    });

    const before = await demoDataCounts(handle.db, ctx.workspaceId);
    expect(before.companies).toBe(50);
    expect(before.weeks).toBe(12);
    const rulesBefore = await handle.db.select().from(fairHousingRule);

    const result = await deleteDemoData(handle.db, ctx);
    expect(result).toMatchObject({ companies: 50, weeks: 12 });

    const left = await handle.db.select().from(company);
    expect(left.map((c) => c.name)).toEqual(["Real Firm LLC"]);
    expect(await handle.db.select().from(mysteryShop)).toHaveLength(1);
    expect(await handle.db.select().from(call)).toHaveLength(0);
    expect(await handle.db.select().from(pilot)).toHaveLength(0);
    expect((await handle.db.select().from(weeklyMetric)).map((w) => w.weekStart)).toEqual(["2027-01-04"]);
    expect(await handle.db.select().from(fairHousingRule)).toHaveLength(rulesBefore.length);
    expect((await handle.db.select().from(script)).length).toBeGreaterThan(0);
    expect((await handle.db.select().from(setting)).length).toBeGreaterThan(0);
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.action, "delete"));
    expect(audits.some((a) => a.entity === "demo_data")).toBe(true);

    expect(await deleteDemoData(handle.db, ctx)).toMatchObject({ companies: 0, weeks: 0 });
    expect(
      await handle.db
        .select()
        .from(company)
        .where(not(like(company.normalizedName, "real firm"))),
    ).toHaveLength(0);
  });
});
