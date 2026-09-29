import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import {
  auditLog,
  company,
  contact,
  deal,
  dncEntry,
  exclusionRule,
  importBatch,
  importMapping,
  pipelineStage,
} from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { commitImport, previewImport } from "@/lib/leads/import";
import {
  bulkSetStatus,
  mergeCompanies,
  possibleDuplicatePairs,
  setSoftwareOverride,
  softwareReviewQueue,
} from "@/lib/leads/manage";

const NOW = new Date("2026-09-29T14:00:00Z");
let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function owner() {
  const o = await insertOwner(handle.db);
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, own: o.own };
}

const CSV = [
  "Company Name,Website,Phone,City,State,Units,Portal",
  "Harborline Residential,harborline.example,(201) 555-0142,Hoboken,NJ,180,Buildium",
  "Quarry Oak Rentals,quarryoak.example,,Newark,NJ,,",
  "Brightwater Homes,brightwater.example,,Jersey City,NJ,,AppFolio",
  "Harbourline Residential Group,other.example,,Hoboken,NJ,,",
  ",nameless.example,,,,,",
].join("\n");

describe("CSV import", () => {
  it("previews with a guessed mapping and classifies every row, writing nothing", async () => {
    const { ctx, own } = await owner();
    await handle.db.insert(company).values({
      ...own,
      name: "Quarry Oak",
      normalizedName: "quarry oak",
      normalizedDomain: "quarryoak.example",
      dncFlag: true,
    });
    const p = await previewImport(handle.db, ctx.workspaceId, CSV);
    expect(p.mapping).toMatchObject({ "Company Name": "name", Website: "website", Portal: "software" });
    // Row 4 only looks like row 1 (similar name, same town): imported, then reviewed on the merge screen.
    expect(p.rows.map((r) => r.status)).toEqual(["new", "dnc", "new", "possible_duplicate", "error"]);
    expect(
      await handle.db.select().from(importBatch).where(eq(importBatch.workspaceId, ctx.workspaceId)),
    ).toHaveLength(0);
  });

  it("imports new rows scored, skips do-not-call and errors, saves the mapping and logs it", async () => {
    const { ctx, own } = await owner();
    await handle.db
      .insert(dncEntry)
      .values({ ...own, kind: "domain", value: "quarryoak.example", reason: "Asked us not to call" });
    const preview = await previewImport(handle.db, ctx.workspaceId, CSV);
    const r = await commitImport(
      handle.db,
      ctx,
      { fileName: "leads.csv", csvText: CSV, mapping: preview.mapping, saveMappingAs: "Scraper v1" },
      NOW,
    );
    expect(r).toMatchObject({ imported: 3, skippedDnc: 1, errors: 1 });
    const firms = await handle.db.select().from(company).where(eq(company.workspaceId, ctx.workspaceId));
    expect(firms.map((f) => f.name).sort()).toEqual([
      "Brightwater Homes",
      "Harborline Residential",
      "Harbourline Residential Group",
    ]);
    const harborline = firms.find((f) => f.name === "Harborline Residential")!;
    expect(harborline).toMatchObject({
      source: "csv",
      estUnits: 180,
      estUnitsSource: "csv",
      detectedSoftware: "buildium",
      isLocal: true,
      status: "new",
    });
    expect(harborline.score).toBeGreaterThan(0);
    expect(firms.find((f) => f.name === "Brightwater Homes")).toMatchObject({ status: "excluded", score: 0 });
    expect(
      await handle.db.select().from(importMapping).where(eq(importMapping.workspaceId, ctx.workspaceId)),
    ).toHaveLength(1);
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.workspaceId, ctx.workspaceId));
    expect(audits.map((a) => a.entity).sort()).toEqual(["company", "import_batch"]);
  });

  it("applies the chain and not-a-fit rules to imported firms", async () => {
    const { ctx, own } = await owner();
    await handle.db
      .insert(exclusionRule)
      .values({ ...own, kind: "chain", category: null, match: "name", pattern: "Greystar" });
    const csv = "name,city\nGreystar Real Estate Partners,New York\nPlain Firm,Hoboken";
    await commitImport(
      handle.db,
      ctx,
      { fileName: "c.csv", csvText: csv, mapping: { name: "name", city: "city" } },
      NOW,
    );
    const firms = await handle.db.select().from(company).where(eq(company.workspaceId, ctx.workspaceId));
    const chain = firms.find((f) => f.name.startsWith("Greystar"))!;
    expect(chain).toMatchObject({ fitStatus: "excluded", fitReason: expect.stringMatching(/Greystar/) });
    expect(chain.scoreBreakdown.some((b) => b.rule === "chainOrNotFit")).toBe(true);
    expect(firms.find((f) => f.name === "Plain Firm")).toMatchObject({ fitStatus: "ok" });
  });

  it("re-importing the same file adds nothing", async () => {
    const { ctx } = await owner();
    const { mapping } = await previewImport(handle.db, ctx.workspaceId, CSV);
    await commitImport(handle.db, ctx, { fileName: "a.csv", csvText: CSV, mapping }, NOW);
    const again = await commitImport(handle.db, ctx, { fileName: "a.csv", csvText: CSV, mapping }, NOW);
    expect(again.imported).toBe(0);
  });

  it("refuses a file without a name column", async () => {
    const { ctx } = await owner();
    await expect(
      commitImport(handle.db, ctx, { fileName: "x.csv", csvText: "a,b\n1,2", mapping: { a: "city" } }, NOW),
    ).rejects.toThrow(/Firm name/);
  });
});

describe("possible duplicates and merge", () => {
  it("finds pairs by website, phone and similar name in a town", async () => {
    const { ctx, own } = await owner();
    const base = { ...own, city: "Hoboken" };
    await handle.db.insert(company).values([
      {
        ...base,
        name: "Harborline Residential",
        normalizedName: "harborline",
        normalizedDomain: "harborline.example",
      },
      { ...base, name: "Harbourline Residential", normalizedName: "harbourline" },
      { ...base, name: "Unrelated Homes", normalizedName: "unrelated", normalizedPhone: "2015550100" },
      { ...base, city: "Newark", name: "Other Name", normalizedName: "other", normalizedPhone: "2015550100" },
    ]);
    const pairs = await possibleDuplicatePairs(handle.db, ctx.workspaceId);
    expect(pairs.map((p) => p.reason).sort()).toEqual(["Same phone", "Similar name in the same town"]);
  });

  it("moves contacts and deals, fills blanks, carries do-not-call, and marks the other merged", async () => {
    const { ctx, own } = await owner();
    const [keep] = await handle.db
      .insert(company)
      .values({ ...own, name: "Keep Co", normalizedName: "keep" })
      .returning();
    const [drop] = await handle.db
      .insert(company)
      .values({
        ...own,
        name: "Drop Co",
        normalizedName: "drop",
        phone: "(201) 555-0142",
        normalizedPhone: "2015550142",
        dncFlag: true,
      })
      .returning();
    await handle.db.insert(contact).values({ ...own, companyId: drop!.id, name: "Pat Example" });
    await mergeCompanies(handle.db, ctx, keep!.id, drop!.id, NOW);
    const [k] = await handle.db.select().from(company).where(eq(company.id, keep!.id));
    const [d] = await handle.db.select().from(company).where(eq(company.id, drop!.id));
    expect(k).toMatchObject({ phone: "(201) 555-0142", dncFlag: true });
    expect(d).toMatchObject({ mergedIntoId: keep!.id, status: "archived", dncFlag: true });
    expect(await handle.db.select().from(contact).where(eq(contact.companyId, keep!.id))).toHaveLength(1);
  });

  it("refuses when both firms have an open deal", async () => {
    const { ctx, own } = await owner();
    const [stage] = await handle.db
      .insert(pipelineStage)
      .values({ ...own, key: "new", name: "New", position: 1, probability: 5 })
      .returning();
    const [a, b] = await handle.db
      .insert(company)
      .values([
        { ...own, name: "A", normalizedName: "a" },
        { ...own, name: "B", normalizedName: "b" },
      ])
      .returning();
    for (const f of [a!, b!])
      await handle.db
        .insert(deal)
        .values({ ...own, companyId: f.id, stageId: stage!.id, probability: 5, expectedMrr: "20.00" });
    await expect(mergeCompanies(handle.db, ctx, a!.id, b!.id, NOW)).rejects.toThrow(/open deal/);
  });
});

describe("software override and review queue", () => {
  it("queues low-confidence and unknown-with-website firms; an override clears it and rescores", async () => {
    const { ctx, own } = await owner();
    const [low] = await handle.db
      .insert(company)
      .values({
        ...own,
        name: "Low",
        normalizedName: "low",
        needsSoftwareReview: true,
        detectedSoftware: "buildium",
        isLocal: true,
      })
      .returning();
    await handle.db
      .insert(company)
      .values({ ...own, name: "Unknown Site", normalizedName: "unknown", websiteUrl: "https://u.example/" });
    await handle.db.insert(company).values({
      ...own,
      name: "Known",
      normalizedName: "known",
      detectedSoftware: "yardi",
      websiteUrl: "https://k.example/",
    });
    expect((await softwareReviewQueue(handle.db, ctx.workspaceId)).map((c) => c.name)).toEqual([
      "Low",
      "Unknown Site",
    ]);

    await setSoftwareOverride(handle.db, ctx, low!.id, "appfolio", "Portal link on /pay-rent", NOW);
    const [after] = await handle.db.select().from(company).where(eq(company.id, low!.id));
    expect(after).toMatchObject({
      softwareOverride: "appfolio",
      needsSoftwareReview: false,
      status: "excluded",
      score: 0,
    });
    expect((await softwareReviewQueue(handle.db, ctx.workspaceId)).map((c) => c.name)).toEqual([
      "Unknown Site",
    ]);

    await setSoftwareOverride(handle.db, ctx, low!.id, "none", null, NOW);
    const [back] = await handle.db.select().from(company).where(eq(company.id, low!.id));
    expect(back!.score).toBeGreaterThan(0);
  });
});

describe("bulk status", () => {
  it("updates many leads but never excluded or do-not-call ones", async () => {
    const { ctx, own } = await owner();
    const rows = await handle.db
      .insert(company)
      .values([
        { ...own, name: "One", normalizedName: "one" },
        { ...own, name: "Two", normalizedName: "two" },
        { ...own, name: "Excluded", normalizedName: "ex", status: "excluded" },
        { ...own, name: "DNC", normalizedName: "dnc", dncFlag: true },
      ])
      .returning();
    const r = await bulkSetStatus(
      handle.db,
      ctx,
      rows.map((x) => x.id),
      "ready",
    );
    expect(r.updated).toBe(2);
    const ready = await handle.db
      .select()
      .from(company)
      .where(and(eq(company.workspaceId, ctx.workspaceId), eq(company.status, "ready")));
    expect(ready.map((x) => x.name).sort()).toEqual(["One", "Two"]);
  });
});
