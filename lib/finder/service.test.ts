import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import {
  auditLog,
  apiUsage,
  company,
  dncEntry,
  enrichmentEvidence,
  placeResult,
  review,
  searchQuery,
  searchRun,
  setting,
  softwarePattern,
  exclusionRule,
} from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { DEFAULT_EXCLUSION_RULES } from "@/lib/domain/exclusion";
import { DEFAULT_SOFTWARE_PATTERNS } from "@/lib/domain/software";
import type { FetchResult } from "@/lib/fetcher/fetcher";
import { fixtureTransport } from "@/lib/finder/fixture-transport";
import { createPlacesClient } from "@/lib/finder/places";
import {
  createSearchRun,
  enrichPending,
  fetchPlaceReviews,
  purgeExpiredGoogleContent,
  runNextQuery,
  triagePlace,
  undoLastTriage,
  usageCounts,
  type PageSource,
} from "@/lib/finder/service";

const NOW = new Date("2026-09-29T14:00:00Z");
const client = createPlacesClient({ apiKey: "test-key", transport: fixtureTransport() });

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function workspace() {
  const { db } = handle;
  const owner = await insertOwner(db);
  await db.insert(softwarePattern).values(DEFAULT_SOFTWARE_PATTERNS.map((p) => ({ ...owner.own, ...p })));
  await db.insert(exclusionRule).values(DEFAULT_EXCLUSION_RULES.map((r) => ({ ...owner.own, ...r })));
  return { ctx: { userId: owner.userId, workspaceId: owner.workspaceId }, own: owner.own };
}

async function runAll(ctx: { userId: string; workspaceId: string }, runId: string) {
  for (let i = 0; i < 50; i += 1) {
    const step = await runNextQuery(handle.db, ctx, runId, client, NOW);
    if (step.done) return step;
  }
  throw new Error("run never finished");
}

const places = (ws: string) => handle.db.select().from(placeResult).where(eq(placeResult.workspaceId, ws));

describe("search runs", () => {
  it("estimates, runs every query, merges keyword variants by place ID and logs usage", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["property management", "property manager"] },
      NOW,
    );
    expect(run).toMatchObject({ plannedQueries: 2, estimatedRequests: 6, status: "planned" });

    const last = await runAll(ctx, run.id);
    expect(last.run).toMatchObject({ status: "done", requestsUsed: 6, resultsFound: 90, newFound: 45 });

    const rows = await places(ctx.workspaceId);
    expect(rows).toHaveLength(45); // the second keyword returned the same places
    expect(rows.find((p) => p.placeId === "fx-hoboken-000")).toMatchObject({ fitStatus: "excluded" });
    expect(rows.find((p) => p.placeId === "fx-hoboken-001")).toMatchObject({ fitStatus: "not_a_fit" });
    const ok = rows.find((p) => p.placeId === "fx-hoboken-010")!;
    expect(ok).toMatchObject({
      fitStatus: "ok",
      dedupeStatus: "new",
      triageStatus: "pending",
      town: "Hoboken",
    });
    expect(ok.why).toMatch(/Software unknown/);
    expect(ok.googleExpiresAt!.getTime() - NOW.getTime()).toBe(30 * 24 * 3600 * 1000);

    const usage = await handle.db.select().from(apiUsage).where(eq(apiUsage.searchRunId, run.id));
    expect(usage).toHaveLength(6);
    expect(usage.every((u) => u.sku === "text_search_enterprise" && u.outcome === "sent")).toBe(true);
    expect(await usageCounts(handle.db, ctx.workspaceId, "search", NOW)).toEqual({ today: 6, month: 6 });
  });

  it("re-running a town surfaces only new firms", async () => {
    const { ctx } = await workspace();
    const towns = [{ town: "Jersey City", state: "NJ" }];
    const first = await createSearchRun(handle.db, ctx, { towns, keywords: ["property management"] }, NOW);
    await runAll(ctx, first.id);
    const second = await createSearchRun(handle.db, ctx, { towns, keywords: ["property management"] }, NOW);
    const done = await runAll(ctx, second.id);
    expect(done.run).toMatchObject({ resultsFound: 22, newFound: 0 });
  });

  it("marks existing leads as duplicates by phone", async () => {
    const { ctx, own } = await workspace();
    await handle.db.insert(company).values({
      ...own,
      name: "Harborline Residential",
      normalizedName: "harborline",
      phone: "(201) 555-0142",
      normalizedPhone: "2015550142",
      city: "Hoboken",
      state: "NJ",
    });
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const dup = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-hoboken-003")!;
    expect(dup).toMatchObject({ dedupeStatus: "duplicate" });
    expect(dup.dedupeReason).toMatch(/same phone/);
  });

  it("stops at the daily cap and skips the rest", async () => {
    const { ctx, own } = await workspace();
    await handle.db.insert(setting).values({
      ...own,
      key: "finder.caps",
      value: { search: { daily: 2, monthly: 900 }, details: { daily: 20, monthly: 200 } },
    });
    const run = await createSearchRun(
      handle.db,
      ctx,
      {
        towns: [
          { town: "Hoboken", state: "NJ" },
          { town: "Jersey City", state: "NJ" },
        ],
        keywords: ["pm"],
      },
      NOW,
    );
    const done = await runAll(ctx, run.id);
    expect(done.run.status).toBe("stopped_cap");
    expect(done.message).toMatch(/Daily cap of 2/);
    const queries = await handle.db.select().from(searchQuery).where(eq(searchQuery.searchRunId, run.id));
    expect(queries.map((q) => q.status).sort()).toEqual(["done", "skipped_cap"]);
    const usage = await handle.db.select().from(apiUsage).where(eq(apiUsage.searchRunId, run.id));
    expect(usage.filter((u) => u.outcome === "sent")).toHaveLength(2);
    expect(usage.filter((u) => u.outcome === "blocked_cap").length).toBeGreaterThan(0);
  });
});

describe("do-not-call protection", () => {
  it("never re-adds a do-not-call firm and keeps the reason visible", async () => {
    const { ctx, own } = await workspace();
    await handle.db.insert(company).values({
      ...own,
      name: "Quarry Oak Rentals",
      normalizedName: "quarry oak",
      domain: "quarryoak.example",
      normalizedDomain: "quarryoak.example",
      dncFlag: true,
    });
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const blocked = (await places(ctx.workspaceId)).find((p) => p.normalizedDomain === "quarryoak.example")!;
    expect(blocked).toMatchObject({ dedupeStatus: "dnc" });
    expect(blocked.dedupeReason).toMatch(/Do not call/);
    await expect(triagePlace(handle.db, ctx, blocked.id, "add", NOW)).rejects.toThrow(/do-not-call/i);
  });
});

describe("enrichment", () => {
  it("fetches the site, stores evidence with sources and rescores", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Jersey City", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-jersey-city-101")!;
    const home = target.websiteUri!;
    const pages: Record<string, string> = {
      [home]: `<html><head><meta property="og:site_name" content="Target Homes"></head><body>
        <a href="/rentals">Rentals</a><a href="https://target.managebuilding.com/Resident/portal">Pay rent</a>
        <a href="tel:2015550199">Call</a><a href="mailto:info@target.example">Email</a>
        <p>We manage over 300 doors across Hudson County.</p></body></html>`,
      [new URL("/rentals", home).toString()]:
        `<div class="listing-item">A</div><div class="listing-item">B</div><div class="listing-item">C</div>`,
    };
    const source: PageSource = {
      get: async (url): Promise<FetchResult> =>
        pages[url]
          ? { ok: true, url, status: 200, html: pages[url]!, bytes: pages[url]!.length, ms: 5 }
          : { ok: false, url, reason: "http", status: 404, bytes: 0, ms: 5 },
    };
    const result = await enrichPending(handle.db, ctx, run.id, source, { limit: 30, only: [target.id] }, NOW);
    expect(result.processed).toBe(1);
    const after = (await places(ctx.workspaceId)).find((p) => p.id === target.id)!;
    expect(after).toMatchObject({ enrichmentStatus: "done", websiteName: "Target Homes" });
    expect(after.why).toBe("Buildium, ~300 units, 3 listings, not shopped yet");
    // not AppFolio 30 + listings 3–25 20 + units 50–500 15 + local 10
    expect(after.score).toBe(75);
    const evidence = await handle.db
      .select()
      .from(enrichmentEvidence)
      .where(eq(enrichmentEvidence.placeResultId, target.id));
    expect(evidence.find((e) => e.kind === "software")).toMatchObject({
      value: "buildium",
      confidence: "high",
    });
    expect(evidence.find((e) => e.kind === "size_units")).toMatchObject({
      value: "300",
      quote: expect.stringContaining("300 doors"),
    });
    expect(evidence.find((e) => e.kind === "email")).toMatchObject({ value: "info@target.example" });
    expect(evidence.every((e) => e.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("updates the lead too when a place is enriched after it was added", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Jersey City", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-jersey-city-103")!;
    const { companyId } = await triagePlace(handle.db, ctx, target.id, "add", NOW);
    const home = target.websiteUri!;
    const source: PageSource = {
      get: async (url) =>
        url === home
          ? {
              ok: true,
              url,
              status: 200,
              html: `<a href="https://x.appfolio.com/connect">Portal</a><p>We manage 220 units.</p>`,
              bytes: 10,
              ms: 1,
            }
          : { ok: false, url, reason: "http", status: 404, bytes: 0, ms: 1 },
    };
    await enrichPending(handle.db, ctx, run.id, source, { only: [target.id] }, NOW);
    const [lead] = await handle.db.select().from(company).where(eq(company.id, companyId!));
    expect(lead).toMatchObject({
      detectedSoftware: "appfolio",
      estUnits: 220,
      estUnitsSource: "website",
      score: 0,
    });
  });

  it("records a failed site instead of hiding it", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Jersey City", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-jersey-city-102")!;
    const source: PageSource = {
      get: async (url) => ({ ok: false, url, reason: "robots", status: null, bytes: 0, ms: 1 }),
    };
    await enrichPending(handle.db, ctx, run.id, source, { limit: 1, only: [target.id] }, NOW);
    const after = (await places(ctx.workspaceId)).find((p) => p.id === target.id)!;
    expect(after.enrichmentStatus).toBe("failed");
  });
});

describe("reviews", () => {
  it("fetches a sample on demand, flags no-callback complaints and adds +10", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-hoboken-004")!;
    const r = await fetchPlaceReviews(handle.db, ctx, target.id, client, NOW);
    expect(r).toMatchObject({ outcome: "ok", flags: 2 });
    const after = (await places(ctx.workspaceId)).find((p) => p.id === target.id)!;
    expect(after.reviewFlagCount).toBe(2);
    expect(after.scoreBreakdown.some((b) => b.rule === "reviewSignals")).toBe(true);
    const saved = await handle.db.select().from(review).where(eq(review.placeResultId, target.id));
    expect(saved).toHaveLength(3);
    expect(saved[0]).toMatchObject({ authorName: expect.any(String), attribution: "Google Maps" });
    const usage = await handle.db
      .select()
      .from(apiUsage)
      .where(and(eq(apiUsage.workspaceId, ctx.workspaceId), eq(apiUsage.sku, "place_details_atmosphere")));
    expect(usage).toHaveLength(1);
  });
});

describe("triage", () => {
  it("adds a place as a New lead, and undo removes it again", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-hoboken-010")!;
    const { companyId } = await triagePlace(handle.db, ctx, target.id, "add", NOW);
    const [lead] = await handle.db.select().from(company).where(eq(company.id, companyId!));
    expect(lead).toMatchObject({
      status: "new",
      source: "finder",
      googlePlaceId: "fx-hoboken-010",
      city: "Hoboken",
      state: "NJ",
      isLocal: true,
      fieldSources: { name: "google", phone: "google", websiteUrl: "google", address: "google" },
    });
    expect(lead!.googleExpiresAt).not.toBeNull();

    const undone = await undoLastTriage(handle.db, ctx, NOW);
    expect(undone).toMatchObject({ undone: "add" });
    expect(await handle.db.select().from(company).where(eq(company.id, companyId!))).toHaveLength(0);
    const back = (await places(ctx.workspaceId)).find((p) => p.id === target.id)!;
    expect(back).toMatchObject({ triageStatus: "pending", companyId: null });
  });

  it("moves a place to Duplicates when adding finds it is already a lead", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      {
        towns: [
          { town: "Hoboken", state: "NJ" },
          { town: "Jersey City", state: "NJ" },
        ],
        keywords: ["pm"],
      },
      NOW,
    );
    await runAll(ctx, run.id);
    const rows = await places(ctx.workspaceId);
    // Fixture places 010 (Hoboken) and 110 (Jersey City) share the phone (201) 555-0110.
    const first = rows.find((r) => r.placeId === "fx-hoboken-010")!;
    const second = rows.find((r) => r.placeId === "fx-jersey-city-110")!;
    await triagePlace(handle.db, ctx, first.id, "add", NOW);
    const result = await triagePlace(handle.db, ctx, second.id, "add", NOW);
    expect(result).toMatchObject({ companyId: null, blocked: expect.stringMatching(/Already a lead/) });
    const after = (await places(ctx.workspaceId)).find((r) => r.id === second.id)!;
    expect(after).toMatchObject({ dedupeStatus: "duplicate", triageStatus: "skipped" });
  });

  it("skip and not-a-fit are undoable; do-not-call is permanent", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const rows = await places(ctx.workspaceId);
    const [a, b, c] = ["fx-hoboken-020", "fx-hoboken-021", "fx-hoboken-022"].map((id) =>
      rows.find((r) => r.placeId === id)!,
    ) as [(typeof rows)[number], (typeof rows)[number], (typeof rows)[number]];
    await triagePlace(handle.db, ctx, a.id, "skip", NOW);
    await triagePlace(handle.db, ctx, b.id, "not_a_fit", NOW);
    expect(await undoLastTriage(handle.db, ctx, NOW)).toMatchObject({ undone: "not_a_fit" });
    expect(await undoLastTriage(handle.db, ctx, NOW)).toMatchObject({ undone: "skip" });

    await triagePlace(handle.db, ctx, c.id, "dnc", NOW);
    const entries = await handle.db.select().from(dncEntry).where(eq(dncEntry.workspaceId, ctx.workspaceId));
    expect(entries.map((e) => e.kind).sort()).toEqual(["domain", "phone", "place_id"]);
    const undo = await undoLastTriage(handle.db, ctx, NOW);
    expect(undo.undone).toBeNull();
    expect(undo.message).toMatch(/permanent/);
    expect((await places(ctx.workspaceId)).find((p) => p.id === c.id)!.triageStatus).toBe("dnc");
  });
});

describe("purgeExpiredGoogleContent", () => {
  it("replaces or blanks expired Google fields, deletes cached reviews and keeps place IDs", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Hoboken", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    const target = (await places(ctx.workspaceId)).find((p) => p.placeId === "fx-hoboken-004")!;
    await fetchPlaceReviews(handle.db, ctx, target.id, client, NOW);
    await handle.db
      .update(placeResult)
      .set({ websiteName: "Site Name From Website" })
      .where(eq(placeResult.id, target.id));
    const { companyId } = await triagePlace(handle.db, ctx, target.id, "add", NOW);

    const later = new Date(NOW.getTime() + 31 * 24 * 3600 * 1000);
    const counts = await purgeExpiredGoogleContent(handle.db, ctx, later);
    expect(counts.places).toBeGreaterThan(40);
    expect(counts.reviews).toBe(3);

    const p = (await places(ctx.workspaceId)).find((x) => x.id === target.id)!;
    expect(p).toMatchObject({
      placeId: "fx-hoboken-004",
      displayName: "Site Name From Website",
      formattedAddress: null,
      nationalPhone: null,
      googleMapsUri: null,
      googleExpiresAt: null,
    });
    const [lead] = await handle.db.select().from(company).where(eq(company.id, companyId!));
    expect(lead).toMatchObject({
      name: "Site Name From Website",
      address: null,
      googlePlaceId: "fx-hoboken-004",
      googleExpiresAt: null,
    });
    expect(lead!.fieldSources.name).toBe("website");
    expect(await handle.db.select().from(review).where(eq(review.placeResultId, target.id))).toHaveLength(0);
    const audits = await handle.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.workspaceId, ctx.workspaceId), eq(auditLog.entity, "google_cache")));
    expect(audits).toHaveLength(1);
    expect(audits[0]!.diff).toMatchObject({ after: { places: counts.places, companies: 1, reviews: 3 } });
  });

  it("does nothing before expiry", async () => {
    const { ctx } = await workspace();
    const run = await createSearchRun(
      handle.db,
      ctx,
      { towns: [{ town: "Jersey City", state: "NJ" }], keywords: ["pm"] },
      NOW,
    );
    await runAll(ctx, run.id);
    expect(await purgeExpiredGoogleContent(handle.db, ctx, NOW)).toEqual({
      places: 0,
      companies: 0,
      reviews: 0,
    });
    const [r] = await handle.db.select().from(searchRun).where(eq(searchRun.id, run.id));
    expect(r!.status).toBe("done");
  });
});
