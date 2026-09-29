// Pipeline (brief M7): one open deal per company, a StageEvent per move, a required lost reason,
// and expected MRR = max($400, vacancies × $119) × probability, recomputed on every change.
import { and, eq, isNull } from "drizzle-orm";
import { withAudit, writeAudit, type AuditContext, type Tx } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { deal, pipelineStage, stageEvent } from "@/lib/db/schema";
import type { Disposition } from "@/lib/domain/calls";
import { expectedMrr } from "@/lib/domain/pipeline";

type Stage = typeof pipelineStage.$inferSelect;
type Deal = typeof deal.$inferSelect;

async function stages(tx: Tx | Db, workspaceId: string): Promise<Stage[]> {
  return (tx as Db)
    .select()
    .from(pipelineStage)
    .where(eq(pipelineStage.workspaceId, workspaceId))
    .orderBy(pipelineStage.position);
}

function stageBy(list: Stage[], key: string): Stage {
  const s = list.find((x) => x.key === key);
  if (!s) throw new Error(`Unknown pipeline stage "${key}".`);
  return s;
}

const money = (n: number) => n.toFixed(2);

async function openDealTx(
  tx: Tx,
  ctx: AuditContext,
  companyId: string,
  stageKey: string,
  now: Date,
): Promise<Deal> {
  const [existing] = await tx
    .select()
    .from(deal)
    .where(and(eq(deal.workspaceId, ctx.workspaceId), eq(deal.companyId, companyId), isNull(deal.closedAt)));
  if (existing) return existing;
  const stage = stageBy(await stages(tx, ctx.workspaceId), stageKey);
  const [row] = await tx
    .insert(deal)
    .values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      companyId,
      stageId: stage.id,
      vacancies: 2,
      probability: stage.probability,
      expectedMrr: money(expectedMrr({ vacancies: 2, probability: stage.probability })),
      closedAt: stage.isWon || stage.isLost ? now : null,
    })
    .returning();
  await tx.insert(stageEvent).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    dealId: row!.id,
    toStageId: stage.id,
    movedAt: now,
  });
  await writeAudit(
    tx,
    ctx,
    { action: "create", entity: "deal" },
    { entityId: row!.id, after: { companyId, stage: stage.key } },
  );
  return row!;
}

export async function openDeal(
  db: Db,
  ctx: AuditContext,
  companyId: string,
  stageKey: string,
  now: Date,
): Promise<Deal> {
  return db.transaction((tx) => openDealTx(tx, ctx, companyId, stageKey, now));
}

async function moveDealTx(
  tx: Tx,
  ctx: AuditContext,
  dealId: string,
  toKey: string,
  opts: { lostReason?: string | null | undefined },
  now: Date,
) {
  const [current] = await tx
    .select()
    .from(deal)
    .where(and(eq(deal.id, dealId), eq(deal.workspaceId, ctx.workspaceId)));
  if (!current) throw new Error("Deal not found.");
  const list = await stages(tx, ctx.workspaceId);
  const to = stageBy(list, toKey);
  if (to.isLost && !opts.lostReason?.trim()) throw new Error("Add a lost reason: say why the deal was lost.");
  if (to.id === current.stageId) return current;
  const [row] = await tx
    .update(deal)
    .set({
      stageId: to.id,
      probability: to.probability,
      expectedMrr: money(expectedMrr({ vacancies: current.vacancies, probability: to.probability })),
      lostReason: to.isLost ? opts.lostReason!.trim() : null,
      closedAt: to.isWon || to.isLost ? now : null,
    })
    .where(eq(deal.id, dealId))
    .returning();
  await tx.insert(stageEvent).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    dealId,
    fromStageId: current.stageId,
    toStageId: to.id,
    movedAt: now,
  });
  await writeAudit(
    tx,
    ctx,
    { action: "update", entity: "deal" },
    {
      entityId: dealId,
      before: { stage: list.find((s) => s.id === current.stageId)?.key },
      after: { stage: to.key, lostReason: to.isLost ? opts.lostReason : undefined },
    },
  );
  return row!;
}

export async function moveDeal(
  db: Db,
  ctx: AuditContext,
  dealId: string,
  toKey: string,
  opts: { lostReason?: string | null | undefined },
  now: Date,
) {
  return db.transaction((tx) => moveDealTx(tx, ctx, dealId, toKey, opts, now));
}

export async function updateDealVacancies(db: Db, ctx: AuditContext, dealId: string, vacancies: number) {
  if (!Number.isInteger(vacancies) || vacancies < 1 || vacancies > 500)
    throw new Error("Vacancies must be a whole number from 1 to 500.");
  return withAudit(db, ctx, { action: "update", entity: "deal" }, async (tx) => {
    const [current] = await tx
      .select()
      .from(deal)
      .where(and(eq(deal.id, dealId), eq(deal.workspaceId, ctx.workspaceId)));
    if (!current) throw new Error("Deal not found.");
    await tx
      .update(deal)
      .set({ vacancies, expectedMrr: money(expectedMrr({ vacancies, probability: current.probability })) })
      .where(eq(deal.id, dealId));
    return { result: null, entityId: dealId, before: { vacancies: current.vacancies }, after: { vacancies } };
  });
}

const CALL_STAGE: Partial<Record<Disposition, string>> = {
  no_answer: "called",
  left_voicemail: "called",
  gatekeeper: "called",
  callback: "called",
  wrong_number: "called",
  conversation: "conversation",
  audit_booked: "audit_review_booked",
};
const CALL_LOST: Partial<Record<Disposition, string>> = {
  not_interested: "Not interested (on a call)",
  do_not_call: "Asked not to be called",
};

/** Moves the firm's deal forward after a call (never backwards); opens one if needed. Returns the deal id. */
export async function advanceDealForCall(
  tx: Tx,
  ctx: AuditContext,
  companyId: string,
  disposition: Disposition,
  now: Date,
): Promise<string | null> {
  const list = await stages(tx, ctx.workspaceId);
  if (list.length === 0) return null;
  const [open] = await tx
    .select()
    .from(deal)
    .where(and(eq(deal.workspaceId, ctx.workspaceId), eq(deal.companyId, companyId), isNull(deal.closedAt)));
  const lostReason = CALL_LOST[disposition];
  if (lostReason) {
    if (!open) return null;
    await moveDealTx(tx, ctx, open.id, list.find((s) => s.isLost)!.key, { lostReason }, now);
    return open.id;
  }
  const target = CALL_STAGE[disposition];
  if (!target) return open?.id ?? null;
  if (!open) return (await openDealTx(tx, ctx, companyId, target, now)).id;
  const currentPos = list.find((s) => s.id === open.stageId)?.position ?? 0;
  if (stageBy(list, target).position > currentPos) await moveDealTx(tx, ctx, open.id, target, {}, now);
  return open.id;
}
