// Lead management (brief M1): merge duplicates, software override + review queue, bulk status.
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { withAudit, writeAudit, type AuditContext, type Tx } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import {
  alert,
  brief,
  call,
  client,
  company,
  companyTag,
  contact,
  deal,
  detectionRun,
  enrichmentEvidence,
  enrichmentRun,
  listing,
  listingSnapshot,
  mysteryShop,
  placeResult,
  review,
  roiScenario,
  vacancyAudit,
} from "@/lib/db/schema";
import { jaroWinkler, FUZZY_NAME_THRESHOLD, normalizeFirmName } from "@/lib/domain/dedupe";
import { DEFAULT_WEIGHTS, type ScoringWeights, type Software } from "@/lib/domain/scoring";
import { rescoreCompany } from "@/lib/finder/service";
import { getSetting } from "@/lib/queries/settings";

type Company = typeof company.$inferSelect;

async function weightsFor(db: Db, workspaceId: string): Promise<ScoringWeights> {
  return {
    ...DEFAULT_WEIGHTS,
    ...(await getSetting<Partial<ScoringWeights>>(db, workspaceId, "scoringWeights", {})),
  };
}

async function loadFirm(tx: Tx | Db, workspaceId: string, id: string): Promise<Company> {
  const [firm] = await (tx as Db)
    .select()
    .from(company)
    .where(and(eq(company.id, id), eq(company.workspaceId, workspaceId)));
  if (!firm) throw new Error("Lead not found.");
  return firm;
}

// ---------------------------------------------------------------------------------------------
// Possible duplicates and merge

export interface DuplicatePair {
  a: Company;
  b: Company;
  reason: string;
}

/** Pairs of live leads that look like the same firm: same website, same phone, or a similar name in the same town. */
export async function possibleDuplicatePairs(db: Db, workspaceId: string): Promise<DuplicatePair[]> {
  const firms = await db
    .select()
    .from(company)
    .where(and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId)));
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>();
  const add = (a: Company, b: Company, reason: string) => {
    const key = [a.id, b.id].sort().join(":");
    if (seen.has(key)) return;
    seen.add(key);
    // Keep the older record on the left: it's usually the one with history.
    pairs.push(a.createdAt <= b.createdAt ? { a, b, reason } : { a: b, b: a, reason });
  };
  const byKey = (key: (c: Company) => string | null, reason: string) => {
    const groups = new Map<string, Company[]>();
    for (const f of firms) {
      const k = key(f);
      if (k) groups.set(k, [...(groups.get(k) ?? []), f]);
    }
    for (const group of groups.values())
      for (let i = 1; i < group.length; i += 1) add(group[0]!, group[i]!, reason);
  };
  byKey((f) => f.normalizedDomain, "Same website");
  byKey((f) => f.normalizedPhone, "Same phone");
  const byCity = new Map<string, Company[]>();
  for (const f of firms)
    if (f.city) byCity.set(f.city.toLowerCase(), [...(byCity.get(f.city.toLowerCase()) ?? []), f]);
  for (const group of byCity.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const [x, y] = [group[i]!, group[j]!];
        if (jaroWinkler(normalizeFirmName(x.name), normalizeFirmName(y.name)) >= FUZZY_NAME_THRESHOLD)
          add(x, y, "Similar name in the same town");
      }
    }
  }
  return pairs;
}

const FILLABLE = [
  "domain",
  "normalizedDomain",
  "websiteUrl",
  "phone",
  "normalizedPhone",
  "city",
  "state",
  "address",
  "estUnits",
  "liveListingsCount",
  "availableRentalsUrl",
  "googlePlaceId",
  "businessEmail",
] as const;

/**
 * Merge `dropId` into `keepId`: everything attached to the dropped firm moves to the kept one, blank
 * fields are filled in, and do-not-call carries over (it's permanent). The dropped row stays, marked
 * merged, so history and audit rows still resolve.
 */
export async function mergeCompanies(db: Db, ctx: AuditContext, keepId: string, dropId: string, now: Date) {
  if (keepId === dropId) throw new Error("Pick two different leads.");
  const weights = await weightsFor(db, ctx.workspaceId);
  return withAudit(db, ctx, { action: "update", entity: "company" }, async (tx) => {
    const [keep, drop] = [
      await loadFirm(tx, ctx.workspaceId, keepId),
      await loadFirm(tx, ctx.workspaceId, dropId),
    ];
    if (keep.mergedIntoId || drop.mergedIntoId) throw new Error("One of these leads was already merged.");
    const openDeals = await tx
      .select({ companyId: deal.companyId })
      .from(deal)
      .where(and(inArray(deal.companyId, [keepId, dropId]), isNull(deal.closedAt)));
    if (new Set(openDeals.map((d) => d.companyId)).size === 2) {
      throw new Error("Both leads have an open deal. Close one of the deals first, then merge.");
    }
    for (const table of [
      contact,
      mysteryShop,
      call,
      deal,
      brief,
      vacancyAudit,
      roiScenario,
      client,
      listing,
      listingSnapshot,
      alert,
      review,
      enrichmentEvidence,
      enrichmentRun,
      detectionRun,
    ]) {
      await tx.update(table).set({ companyId: keepId }).where(eq(table.companyId, dropId));
    }
    await tx.update(placeResult).set({ companyId: keepId }).where(eq(placeResult.companyId, dropId));
    await tx
      .update(placeResult)
      .set({ dedupeCompanyId: keepId })
      .where(eq(placeResult.dedupeCompanyId, dropId));
    // Tags: move the ones the kept firm doesn't already have.
    const keepTags = new Set(
      (
        await tx.select({ tagId: companyTag.tagId }).from(companyTag).where(eq(companyTag.companyId, keepId))
      ).map((t) => t.tagId),
    );
    const dropTags = await tx.select().from(companyTag).where(eq(companyTag.companyId, dropId));
    for (const t of dropTags) {
      if (keepTags.has(t.tagId)) await tx.delete(companyTag).where(eq(companyTag.id, t.id));
      else await tx.update(companyTag).set({ companyId: keepId }).where(eq(companyTag.id, t.id));
    }
    const patch: Partial<typeof company.$inferInsert> = {};
    for (const key of FILLABLE) {
      if ((keep[key] === null || keep[key] === undefined) && drop[key] !== null && drop[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = drop[key];
      }
    }
    if (drop.dncFlag) patch.dncFlag = true;
    if (keep.detectedSoftware === "unknown" && drop.detectedSoftware !== "unknown") {
      patch.detectedSoftware = drop.detectedSoftware;
      patch.softwareEvidence = drop.softwareEvidence;
    }
    if (!keep.softwareOverride && drop.softwareOverride) patch.softwareOverride = drop.softwareOverride;
    if (Object.keys(patch).length) await tx.update(company).set(patch).where(eq(company.id, keepId));
    await tx.update(company).set({ mergedIntoId: keepId, status: "archived" }).where(eq(company.id, dropId));
    await rescoreCompany(tx, ctx, keepId, weights, `Merged with ${drop.name}`, now);
    await writeAudit(
      tx,
      ctx,
      { action: "update", entity: "company" },
      { entityId: dropId, after: { mergedIntoId: keepId } },
    );
    return {
      result: { keepId },
      entityId: keepId,
      after: { mergedFrom: dropId, filled: Object.keys(patch) },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Software override and the review queue

/**
 * The founder's call on a firm's software, with an optional evidence note. Clears the review flag.
 * AppFolio → excluded (score 0); moving off AppFolio brings an excluded firm back as New.
 */
export async function setSoftwareOverride(
  db: Db,
  ctx: AuditContext,
  companyId: string,
  software: Software | null,
  note: string | null,
  now: Date,
) {
  const weights = await weightsFor(db, ctx.workspaceId);
  return withAudit(db, ctx, { action: "update", entity: "company" }, async (tx) => {
    const firm = await loadFirm(tx, ctx.workspaceId, companyId);
    const effective = software ?? firm.detectedSoftware;
    const status =
      effective === "appfolio"
        ? "excluded"
        : firm.status === "excluded" && firm.detectedSoftware === "appfolio"
          ? "new"
          : firm.status;
    await tx
      .update(company)
      .set({
        softwareOverride: software,
        softwareEvidence: note?.trim() ? note.trim() : firm.softwareEvidence,
        needsSoftwareReview: false,
        status,
      })
      .where(eq(company.id, companyId));
    if (software) {
      await tx.insert(detectionRun).values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId,
        method: "manual",
        software,
        evidence: note?.trim() || null,
        confidence: "1.00",
      });
    }
    await rescoreCompany(tx, ctx, companyId, weights, "Software set by hand", now);
    return {
      result: null,
      entityId: companyId,
      before: { softwareOverride: firm.softwareOverride },
      after: { softwareOverride: software },
    };
  });
}

/** Leads whose software needs a human look: low-confidence detection, or never determined but have a website. */
export async function softwareReviewQueue(db: Db, workspaceId: string) {
  return db
    .select()
    .from(company)
    .where(
      and(
        eq(company.workspaceId, workspaceId),
        isNull(company.mergedIntoId),
        isNull(company.softwareOverride),
        ne(company.status, "archived"),
        sql`(${company.needsSoftwareReview} or (${company.detectedSoftware} = 'unknown' and ${company.websiteUrl} is not null))`,
      ),
    )
    .orderBy(sql`${company.needsSoftwareReview} desc`, sql`${company.score} desc`);
}

// ---------------------------------------------------------------------------------------------
// Bulk status

export const BULK_STATUSES = ["new", "researching", "ready", "contacted", "archived"] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

/** Sets a status on many leads at once. Excluded (AppFolio / do-not-call) firms are left alone. */
export async function bulkSetStatus(db: Db, ctx: AuditContext, ids: string[], status: BulkStatus) {
  if (ids.length === 0) return { updated: 0 };
  return withAudit(db, ctx, { action: "update", entity: "company" }, async (tx) => {
    const rows = await tx
      .update(company)
      .set({ status })
      .where(
        and(
          eq(company.workspaceId, ctx.workspaceId),
          inArray(company.id, ids),
          ne(company.status, "excluded"),
          eq(company.dncFlag, false),
        ),
      )
      .returning({ id: company.id });
    return { result: { updated: rows.length }, after: { ids: rows.map((r) => r.id), status } };
  });
}
