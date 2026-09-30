// Vacancy audits (brief M8): freeze the data, take the founder's summary, run the number and
// fair-housing checks, and release the PDF only for exactly the text that passed.
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import { isCleared, runCheck, type CheckResult } from "@/lib/compliance/fair-housing";
import type { Db } from "@/lib/db/client";
import { company, fairHousingCheck, mysteryShop, roiScenario, vacancyAudit } from "@/lib/db/schema";
import { auditText, buildSnapshot, exportProblems, type AuditSnapshot } from "@/lib/domain/audit";
import { DEFAULT_ROI_INPUTS, type RoiInputs } from "@/lib/domain/roi";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

async function loadAudit(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(vacancyAudit)
    .where(and(eq(vacancyAudit.id, id), eq(vacancyAudit.workspaceId, workspaceId)));
  if (!row) throw new Error("Audit not found.");
  return { ...row, snapshot: row.dataSnapshot as unknown as AuditSnapshot };
}

export async function createAudit(db: Db, ctx: AuditContext, companyId: string, now: Date): Promise<string> {
  const [firm] = await db
    .select()
    .from(company)
    .where(and(eq(company.id, companyId), eq(company.workspaceId, ctx.workspaceId)));
  if (!firm) throw new Error("Lead not found.");
  const shopCols = {
    companyId: mysteryShop.companyId,
    sentAt: mysteryShop.sentAt,
    firstReplyAt: mysteryShop.firstReplyAt,
    hoursBucket: mysteryShop.hoursBucket,
    channel: mysteryShop.channel,
    replyType: mysteryShop.replyType,
    tourOffered: mysteryShop.tourOffered,
  };
  const [firmShops, metroShops, [scenario]] = await Promise.all([
    db
      .select(shopCols)
      .from(mysteryShop)
      .where(and(eq(mysteryShop.workspaceId, ctx.workspaceId), eq(mysteryShop.companyId, companyId))),
    firm.metro
      ? db
          .select(shopCols)
          .from(mysteryShop)
          .innerJoin(company, eq(company.id, mysteryShop.companyId))
          .where(
            and(
              eq(mysteryShop.workspaceId, ctx.workspaceId),
              eq(company.metro, firm.metro),
              isNull(company.mergedIntoId),
            ),
          )
      : Promise.resolve([]),
    db
      .select()
      .from(roiScenario)
      .where(and(eq(roiScenario.workspaceId, ctx.workspaceId), eq(roiScenario.companyId, companyId)))
      .orderBy(desc(roiScenario.createdAt))
      .limit(1),
  ]);
  const snapshot = buildSnapshot({
    firm: { name: firm.name, metro: firm.metro },
    // A shop with no reply has no tour to report either way.
    firmShops: firmShops.map((s) => ({ ...s, tourOffered: s.replyType === "none" ? null : s.tourOffered })),
    metroShops,
    roi: scenario
      ? { inputs: { ...DEFAULT_ROI_INPUTS, ...(scenario.inputs as Partial<RoiInputs>) }, source: "saved" }
      : { inputs: DEFAULT_ROI_INPUTS, source: "default" },
    now,
  });
  return withAudit(db, ctx, { action: "create", entity: "vacancy_audit" }, async (tx) => {
    const [row] = await tx
      .insert(vacancyAudit)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId,
        dataSnapshot: snapshot as unknown as Record<string, unknown>,
      })
      .returning();
    return { result: row!.id, entityId: row!.id, after: { companyId, shops: snapshot.shops.length } };
  });
}

export async function saveSummary(db: Db, ctx: AuditContext, id: string, summary: string) {
  const audit = await loadAudit(db, ctx.workspaceId, id);
  const clean = summary.trim();
  await withAudit(db, ctx, { action: "update", entity: "vacancy_audit" }, async (tx) => {
    await tx
      .update(vacancyAudit)
      // New wording needs new checks: an old pass or export no longer describes this text.
      .set({
        summary: clean || null,
        summaryAuthor: "founder",
        ...(clean === (audit.summary ?? "") ? {} : { fairHousingCheckId: null, pdfGeneratedAt: null }),
      })
      .where(eq(vacancyAudit.id, id));
    return { result: null, entityId: id, before: { summary: audit.summary }, after: { summary: clean } };
  });
  return { problems: exportProblems(clean, audit.snapshot) };
}

export type PrepareResult =
  | { ready: true; check: CheckResult; problems: [] }
  | { ready: false; check: CheckResult | null; problems: string[] };

/** Runs the number check, then the fair-housing check on the whole page. */
export async function prepareExport(db: Db, ctx: AuditContext, id: string): Promise<PrepareResult> {
  const audit = await loadAudit(db, ctx.workspaceId, id);
  const summary = audit.summary ?? "";
  const problems = exportProblems(summary, audit.snapshot);
  if (problems.length) return { ready: false, check: null, problems };
  const check = await runCheck(db, ctx, {
    entityType: "vacancy_audit",
    entityId: id,
    text: auditText(audit.snapshot, summary),
  });
  await withAudit(db, ctx, { action: "update", entity: "vacancy_audit" }, async (tx) => {
    await tx.update(vacancyAudit).set({ fairHousingCheckId: check.id }).where(eq(vacancyAudit.id, id));
    return { result: null, entityId: id, after: { fairHousingCheckId: check.id, outcome: check.outcome } };
  });
  return isCleared(check) ? { ready: true, check, problems: [] } : { ready: false, check, problems: [] };
}

/**
 * Releases the page for the PDF. The linked check must be cleared and must have covered exactly
 * this text, so an edit after the check can't slip through.
 */
export async function exportAudit(db: Db, ctx: AuditContext, id: string, now: Date) {
  const audit = await loadAudit(db, ctx.workspaceId, id);
  const summary = audit.summary ?? "";
  const text = auditText(audit.snapshot, summary);
  const [check] = audit.fairHousingCheckId
    ? await db.select().from(fairHousingCheck).where(eq(fairHousingCheck.id, audit.fairHousingCheckId))
    : [];
  if (
    !check ||
    !isCleared(check) ||
    check.textHash !== hash(text) ||
    exportProblems(summary, audit.snapshot).length
  )
    throw new Error("Run the checks on this version of the audit before exporting.");
  await withAudit(db, ctx, { action: "export", entity: "vacancy_audit" }, async (tx) => {
    await tx.update(vacancyAudit).set({ pdfGeneratedAt: now }).where(eq(vacancyAudit.id, id));
    return { result: null, entityId: id, after: { pdfGeneratedAt: now } };
  });
  return { firmName: audit.snapshot.firmName, snapshot: audit.snapshot, summary, text, checkId: check.id };
}

export async function listAudits(db: Db, workspaceId: string) {
  return db
    .select({
      id: vacancyAudit.id,
      companyId: vacancyAudit.companyId,
      firmName: company.name,
      summary: vacancyAudit.summary,
      createdAt: vacancyAudit.createdAt,
      pdfGeneratedAt: vacancyAudit.pdfGeneratedAt,
      checkOutcome: fairHousingCheck.outcome,
      overrideReason: fairHousingCheck.overrideReason,
    })
    .from(vacancyAudit)
    .innerJoin(company, eq(company.id, vacancyAudit.companyId))
    .leftJoin(fairHousingCheck, eq(fairHousingCheck.id, vacancyAudit.fairHousingCheckId))
    .where(eq(vacancyAudit.workspaceId, workspaceId))
    .orderBy(desc(vacancyAudit.createdAt));
}

export async function getAudit(db: Db, workspaceId: string, id: string) {
  const audit = await loadAudit(db, workspaceId, id);
  const [check] = audit.fairHousingCheckId
    ? await db.select().from(fairHousingCheck).where(eq(fairHousingCheck.id, audit.fairHousingCheckId))
    : [];
  const current = check ? check.textHash === hash(auditText(audit.snapshot, audit.summary ?? "")) : false;
  return { ...audit, check: check && current ? check : null };
}
