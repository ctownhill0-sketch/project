// "Delete demo data" (brief M18): removes the fictional seed firms and everything attached to them,
// plus the seeded weekly numbers. Real firms, settings, rules, scripts and the audit log stay.
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { withAudit, type AuditContext, type Tx } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { DEMO_DOMAIN_SUFFIX, DEMO_PHONE_LIKE, DEMO_WEEK_NOTE } from "@/lib/seed/markers";

type Handling = "delete" | "unlink";
interface Reference {
  table: string;
  column: string;
  handling: Handling;
}

/**
 * Every column that points at a company, client, deal, pilot or vacancy, and what happens to its
 * rows. A test checks this against the live database catalog, so a new table can't be missed.
 * "unlink" keeps the row (it's a log, or came from Google) and clears the pointer.
 */
export const DEMO_REFERENCES: Reference[] = [
  { table: "pilot_metric", column: "pilot_id", handling: "delete" },
  { table: "pilot_metric", column: "vacancy_id", handling: "delete" },
  { table: "stage_event", column: "deal_id", handling: "delete" },
  { table: "pilot", column: "client_id", handling: "delete" },
  { table: "vacancy", column: "client_id", handling: "delete" },
  { table: "company_brain", column: "client_id", handling: "delete" },
  { table: "owner_report", column: "client_id", handling: "delete" },
  { table: "transcript", column: "client_id", handling: "delete" },
  { table: "api_usage", column: "company_id", handling: "unlink" },
  { table: "place_result", column: "company_id", handling: "unlink" },
  { table: "place_result", column: "dedupe_company_id", handling: "unlink" },
  { table: "triage_decision", column: "company_id", handling: "unlink" },
  { table: "alert", column: "company_id", handling: "delete" },
  { table: "brief", column: "company_id", handling: "delete" },
  { table: "call", column: "company_id", handling: "delete" },
  { table: "client", column: "company_id", handling: "delete" },
  { table: "company_tag", column: "company_id", handling: "delete" },
  { table: "contact", column: "company_id", handling: "delete" },
  { table: "deal", column: "company_id", handling: "delete" },
  { table: "detection_run", column: "company_id", handling: "delete" },
  { table: "enrichment_evidence", column: "company_id", handling: "delete" },
  { table: "enrichment_run", column: "company_id", handling: "delete" },
  { table: "listing", column: "company_id", handling: "delete" },
  { table: "listing_snapshot", column: "company_id", handling: "delete" },
  { table: "mystery_shop", column: "company_id", handling: "delete" },
  { table: "review", column: "company_id", handling: "delete" },
  { table: "roi_scenario", column: "company_id", handling: "delete" },
  { table: "score_history", column: "company_id", handling: "delete" },
  { table: "vacancy_audit", column: "company_id", handling: "delete" },
];

/** A demo firm has a reserved `.example` domain or a reserved 555-01xx phone. Real firms have neither. */
const isDemo = (workspaceId: string) =>
  and(
    eq(s.company.workspaceId, workspaceId),
    or(
      like(s.company.normalizedDomain, `%${DEMO_DOMAIN_SUFFIX}`),
      like(s.company.normalizedPhone, DEMO_PHONE_LIKE),
    ),
  );

export async function demoDataCounts(db: Db, workspaceId: string) {
  const [firms] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.company)
    .where(isDemo(workspaceId));
  const [weeks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.weeklyMetric)
    .where(and(eq(s.weeklyMetric.workspaceId, workspaceId), eq(s.weeklyMetric.notes, DEMO_WEEK_NOTE)));
  return { companies: firms?.n ?? 0, weeks: weeks?.n ?? 0 };
}

async function ids(
  tx: Tx,
  table: PgTable & { id: PgColumn },
  column: PgColumn,
  parents: string[],
): Promise<string[]> {
  if (!parents.length) return [];
  const rows = await tx.select({ id: table.id }).from(table).where(inArray(column, parents));
  return rows.map((r) => r.id as string);
}

async function remove(tx: Tx, table: PgTable, column: PgColumn, parents: string[]) {
  if (parents.length) await tx.delete(table).where(inArray(column, parents));
}

export async function deleteDemoData(db: Db, ctx: AuditContext) {
  return withAudit(db, ctx, { action: "delete", entity: "demo_data" }, async (tx) => {
    const firms = (await tx.select({ id: s.company.id }).from(s.company).where(isDemo(ctx.workspaceId))).map(
      (r) => r.id,
    );
    const clients = await ids(tx, s.client, s.client.companyId, firms);
    const deals = await ids(tx, s.deal, s.deal.companyId, firms);
    const pilots = await ids(tx, s.pilot, s.pilot.clientId, clients);
    const vacancies = await ids(tx, s.vacancy, s.vacancy.clientId, clients);
    const reviews = await ids(tx, s.review, s.review.companyId, firms);
    const transcripts = await ids(tx, s.transcript, s.transcript.clientId, clients);
    const brains = await ids(tx, s.companyBrain, s.companyBrain.clientId, clients);
    const reports = await ids(tx, s.ownerReport, s.ownerReport.clientId, clients);
    const runs = await ids(tx, s.enrichmentRun, s.enrichmentRun.companyId, firms);

    // Children of children first, then the rows that point at a firm, then the firms.
    await remove(tx, s.pilotMetric, s.pilotMetric.pilotId, pilots);
    await remove(tx, s.pilotMetric, s.pilotMetric.vacancyId, vacancies);
    await remove(tx, s.pilot, s.pilot.id, pilots);
    await remove(tx, s.vacancy, s.vacancy.id, vacancies);
    await remove(tx, s.objectionTag, s.objectionTag.transcriptId, transcripts);
    await remove(tx, s.transcript, s.transcript.id, transcripts);
    await remove(tx, s.companyBrainVersion, s.companyBrainVersion.brainId, brains);
    await remove(tx, s.companyBrain, s.companyBrain.id, brains);
    await remove(tx, s.reportView, s.reportView.ownerReportId, reports);
    await remove(tx, s.ownerReport, s.ownerReport.id, reports);
    await remove(tx, s.stageEvent, s.stageEvent.dealId, deals);
    await remove(tx, s.reviewClassification, s.reviewClassification.reviewId, reviews);
    await remove(tx, s.enrichmentEvidence, s.enrichmentEvidence.enrichmentRunId, runs);
    if (firms.length) {
      await tx.update(s.apiUsage).set({ companyId: null }).where(inArray(s.apiUsage.companyId, firms));
      await tx.update(s.placeResult).set({ companyId: null }).where(inArray(s.placeResult.companyId, firms));
      await tx
        .update(s.placeResult)
        .set({ dedupeCompanyId: null })
        .where(inArray(s.placeResult.dedupeCompanyId, firms));
      await tx
        .update(s.triageDecision)
        .set({ companyId: null })
        .where(inArray(s.triageDecision.companyId, firms));
    }
    for (const t of [
      s.call, // before contacts: a call can point at a contact
      s.alert,
      s.brief,
      s.client,
      s.companyTag,
      s.contact,
      s.deal,
      s.detectionRun,
      s.enrichmentEvidence,
      s.enrichmentRun,
      s.listingSnapshot,
      s.listing,
      s.mysteryShop,
      s.review,
      s.roiScenario,
      s.scoreHistory,
      s.vacancyAudit,
    ] as const) {
      await remove(tx, t, t.companyId, firms);
    }
    if (firms.length) {
      // Merges can point from one firm to another; clear them before deleting.
      await tx.update(s.company).set({ mergedIntoId: null }).where(inArray(s.company.mergedIntoId, firms));
      await tx.delete(s.company).where(inArray(s.company.id, firms));
    }
    const weeks = await tx
      .delete(s.weeklyMetric)
      .where(and(eq(s.weeklyMetric.workspaceId, ctx.workspaceId), eq(s.weeklyMetric.notes, DEMO_WEEK_NOTE)))
      .returning({ id: s.weeklyMetric.id });
    const result = { companies: firms.length, weeks: weeks.length };
    return { result, after: result };
  });
}
