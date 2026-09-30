// Fair-housing checks (brief M14, layer 1): run, log, override, and edit the rule list.
// Only a hash of the checked text is stored. Screening aid, not legal advice.
import { createHash } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { fairHousingCheck, fairHousingRule, script } from "@/lib/db/schema";
import {
  checkText,
  validatePattern,
  type Match,
  type Outcome,
  type Rule,
  type Severity,
} from "@/lib/domain/fair-housing";

export const MIN_OVERRIDE_REASON = 10;

export interface CheckResult {
  id: string;
  outcome: Outcome;
  matches: Match[];
  overrideReason: string | null;
  overriddenAt: Date | null;
}

export function isCleared(check: { outcome: Outcome; overrideReason: string | null }): boolean {
  return check.outcome === "pass" || (check.outcome === "warn" && !!check.overrideReason);
}

export async function activeRules(db: Db, workspaceId: string): Promise<(Rule & { id: string })[]> {
  const rows = await db
    .select()
    .from(fairHousingRule)
    .where(and(eq(fairHousingRule.workspaceId, workspaceId), eq(fairHousingRule.isActive, true)))
    .orderBy(asc(fairHousingRule.createdAt), asc(fairHousingRule.id));
  return rows;
}

export async function allRules(db: Db, workspaceId: string) {
  return db
    .select()
    .from(fairHousingRule)
    .where(eq(fairHousingRule.workspaceId, workspaceId))
    .orderBy(asc(fairHousingRule.category), asc(fairHousingRule.createdAt));
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** Checks a text against the workspace's active rules and logs the result. */
export async function runCheck(
  db: Db,
  ctx: AuditContext,
  input: { entityType: string; entityId: string | null; text: string },
): Promise<CheckResult> {
  const { outcome, matches } = checkText(input.text, await activeRules(db, ctx.workspaceId));
  return withAudit(db, ctx, { action: "create", entity: "fair_housing_check" }, async (tx) => {
    const [row] = await tx
      .insert(fairHousingCheck)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        textHash: hash(input.text),
        outcome,
        matches: matches.map(({ ruleId, phrase, category, severity }) => ({
          ruleId,
          phrase,
          category,
          severity,
        })),
      })
      .returning();
    return {
      result: { id: row!.id, outcome, matches, overrideReason: null, overriddenAt: null },
      entityId: row!.id,
      after: {
        entityType: input.entityType,
        entityId: input.entityId,
        outcome,
        categories: matches.map((m) => m.category),
      },
    };
  });
}

/** A warning can be cleared with a written reason. A block can't: change the wording or fix the rule. */
export async function overrideCheck(db: Db, ctx: AuditContext, checkId: string, reason: string, now: Date) {
  const clean = reason.trim();
  if (clean.length < MIN_OVERRIDE_REASON)
    throw new Error(`Write a reason of at least ${MIN_OVERRIDE_REASON} characters.`);
  return withAudit(db, ctx, { action: "update", entity: "fair_housing_check" }, async (tx) => {
    const [row] = await tx
      .select()
      .from(fairHousingCheck)
      .where(and(eq(fairHousingCheck.id, checkId), eq(fairHousingCheck.workspaceId, ctx.workspaceId)));
    if (!row) throw new Error("Check not found.");
    if (row.outcome === "block")
      throw new Error("Blocked text can't be overridden. Change the wording, or fix the rule if it's wrong.");
    const [updated] = await tx
      .update(fairHousingCheck)
      .set({ overrideReason: clean, overriddenAt: now })
      .where(eq(fairHousingCheck.id, checkId))
      .returning();
    return {
      result: { ...updated!, matches: updated!.matches as Match[] } as CheckResult,
      entityId: checkId,
      after: { overrideReason: clean },
    };
  });
}

export async function latestCheck(db: Db, workspaceId: string, entityType: string, entityId: string) {
  const [row] = await db
    .select()
    .from(fairHousingCheck)
    .where(
      and(
        eq(fairHousingCheck.workspaceId, workspaceId),
        eq(fairHousingCheck.entityType, entityType),
        eq(fairHousingCheck.entityId, entityId),
      ),
    )
    .orderBy(desc(fairHousingCheck.createdAt))
    .limit(1);
  return row ?? null;
}

/** The latest check that covered exactly this text (by hash), so a rejected draft never labels saved text. */
export async function checkForText(
  db: Db,
  workspaceId: string,
  entityType: string,
  entityId: string,
  text: string,
) {
  const [row] = await db
    .select()
    .from(fairHousingCheck)
    .where(
      and(
        eq(fairHousingCheck.workspaceId, workspaceId),
        eq(fairHousingCheck.entityType, entityType),
        eq(fairHousingCheck.entityId, entityId),
        eq(fairHousingCheck.textHash, hash(text)),
      ),
    )
    .orderBy(desc(fairHousingCheck.createdAt))
    .limit(1);
  return row ?? null;
}

export async function recentChecks(db: Db, workspaceId: string, limit = 50) {
  return db
    .select()
    .from(fairHousingCheck)
    .where(eq(fairHousingCheck.workspaceId, workspaceId))
    .orderBy(desc(fairHousingCheck.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------------------------
// Rules

export interface RuleInput {
  id?: string | undefined;
  pattern: string;
  category: string;
  severity: Severity;
  explanation: string;
  saferRewrite: string | null;
}

export async function saveRule(db: Db, ctx: AuditContext, input: RuleInput): Promise<string> {
  const problem = validatePattern(input.pattern);
  if (problem) throw new Error(problem);
  const values = {
    pattern: input.pattern,
    category: input.category.trim() || "other",
    severity: input.severity,
    explanation: input.explanation.trim(),
    saferRewrite: input.saferRewrite?.trim() || null,
  };
  if (!values.explanation) throw new Error("Say why this phrase is a problem.");
  if (input.id) {
    const id = input.id;
    return withAudit(db, ctx, { action: "update", entity: "fair_housing_rule" }, async (tx) => {
      const [before] = await tx
        .select()
        .from(fairHousingRule)
        .where(and(eq(fairHousingRule.id, id), eq(fairHousingRule.workspaceId, ctx.workspaceId)));
      if (!before) throw new Error("Rule not found.");
      await tx.update(fairHousingRule).set(values).where(eq(fairHousingRule.id, id));
      return { result: id, entityId: id, before, after: values };
    });
  }
  return withAudit(db, ctx, { action: "create", entity: "fair_housing_rule" }, async (tx) => {
    const [row] = await tx
      .insert(fairHousingRule)
      .values({ workspaceId: ctx.workspaceId, createdById: ctx.userId, ...values })
      .returning();
    return { result: row!.id, entityId: row!.id, after: values };
  });
}

export async function setRuleActive(db: Db, ctx: AuditContext, id: string, isActive: boolean) {
  return withAudit(db, ctx, { action: "update", entity: "fair_housing_rule" }, async (tx) => {
    const rows = await tx
      .update(fairHousingRule)
      .set({ isActive })
      .where(and(eq(fairHousingRule.id, id), eq(fairHousingRule.workspaceId, ctx.workspaceId)))
      .returning({ id: fairHousingRule.id });
    if (!rows.length) throw new Error("Rule not found.");
    return { result: null, entityId: id, after: { isActive } };
  });
}

// ---------------------------------------------------------------------------------------------
// Scripts: every save is checked. Block refuses; a warning needs a reason.

export type SaveScriptResult =
  | { saved: true; outcome: Outcome; check: CheckResult }
  | { saved: false; outcome: "warn" | "block"; check: CheckResult };

export async function saveScript(
  db: Db,
  ctx: AuditContext,
  input: { id: string; body: string; overrideReason?: string | undefined },
  now: Date,
): Promise<SaveScriptResult> {
  const [existing] = await db
    .select()
    .from(script)
    .where(and(eq(script.id, input.id), eq(script.workspaceId, ctx.workspaceId)));
  if (!existing) throw new Error("Script not found.");
  const body = input.body.trim();
  if (!body) throw new Error("A script can't be empty.");
  let check = await runCheck(db, ctx, { entityType: "script", entityId: input.id, text: body });
  if (check.outcome === "block") return { saved: false, outcome: "block", check };
  if (check.outcome === "warn") {
    if (!input.overrideReason?.trim()) return { saved: false, outcome: "warn", check };
    check = {
      ...(await overrideCheck(db, ctx, check.id, input.overrideReason, now)),
      matches: check.matches,
    };
  }
  await withAudit(db, ctx, { action: "update", entity: "script" }, async (tx) => {
    await tx.update(script).set({ body }).where(eq(script.id, input.id));
    return { result: null, entityId: input.id, before: { body: existing.body }, after: { body } };
  });
  return { saved: true, outcome: check.outcome, check };
}
