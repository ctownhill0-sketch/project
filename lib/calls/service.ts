// Call logging (brief M6). tel: links only (the app never dials). Do-not-call is permanent: it sets
// the firm's flag (the database refuses to clear it), closes the open deal, and blocks further calls.
import { and, eq, sql } from "drizzle-orm";
import { withAudit, writeAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { call, company, objection } from "@/lib/db/schema";
import { suggestNextStep, type Disposition } from "@/lib/domain/calls";
import { advanceDealForCall } from "@/lib/pipeline/service";

export interface LogCallInput {
  companyId: string;
  disposition: Disposition;
  notes?: string | null | undefined;
  nextStepAt?: Date | null | undefined;
  nextStepNote?: string | null | undefined;
  isDecisionMakerConversation?: boolean | undefined;
}

export async function logCall(db: Db, ctx: AuditContext, input: LogCallInput, now: Date) {
  if (input.nextStepAt && input.nextStepAt.getTime() < now.getTime() - 60_000)
    throw new Error("The next step can't be in the past.");
  return withAudit(db, ctx, { action: "create", entity: "call" }, async (tx) => {
    const [firm] = await tx
      .select()
      .from(company)
      .where(and(eq(company.id, input.companyId), eq(company.workspaceId, ctx.workspaceId)));
    if (!firm || firm.mergedIntoId) throw new Error("Lead not found.");
    if (firm.dncFlag) throw new Error("This firm is marked do not call. It can't be called again.");
    const nextStepAt =
      input.disposition === "do_not_call"
        ? null
        : (input.nextStepAt ?? suggestNextStep(input.disposition, now));
    const [row] = await tx
      .insert(call)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId: firm.id,
        calledAt: now,
        disposition: input.disposition,
        isDecisionMakerConversation: input.isDecisionMakerConversation ?? false,
        notes: input.notes?.trim() || null,
        nextStepAt,
        nextStepNote: input.nextStepNote?.trim() || null,
      })
      .returning();
    const patch: Partial<typeof company.$inferInsert> = {};
    if (firm.status === "new" || firm.status === "researching" || firm.status === "ready")
      patch.status = "contacted";
    if (input.disposition === "do_not_call") patch.dncFlag = true;
    if (Object.keys(patch).length) await tx.update(company).set(patch).where(eq(company.id, firm.id));
    if (input.disposition === "do_not_call") {
      await writeAudit(
        tx,
        ctx,
        { action: "update", entity: "company" },
        { entityId: firm.id, after: { dncFlag: true, reason: "Asked on a call" } },
      );
    }
    await advanceDealForCall(tx, ctx, firm.id, input.disposition, now);
    return { result: row!, entityId: row!.id, after: row };
  });
}

export async function recordObjectionHeard(db: Db, ctx: AuditContext, objectionId: string) {
  return withAudit(db, ctx, { action: "update", entity: "objection" }, async (tx) => {
    const [row] = await tx
      .update(objection)
      .set({ timesHeard: sql`${objection.timesHeard} + 1` })
      .where(and(eq(objection.id, objectionId), eq(objection.workspaceId, ctx.workspaceId)))
      .returning({ timesHeard: objection.timesHeard });
    if (!row) throw new Error("Objection not found.");
    return { result: row.timesHeard, entityId: objectionId, after: { timesHeard: row.timesHeard } };
  });
}
