// Settings that do more than store a value (brief M18): changing weights rescores every lead,
// changing business hours re-buckets every shop, and the weekly numbers and rule lists get
// their own rows. Everything goes through withAudit.
import { and, eq, isNull } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { company, exclusionRule, mysteryShop, softwarePattern, weeklyMetric } from "@/lib/db/schema";
import { hoursBucket, type BusinessHours } from "@/lib/domain/hours";
import type { ScoringWeights } from "@/lib/domain/scoring";
import { rescoreCompany } from "@/lib/finder/service";
import { saveSetting } from "@/lib/settings/save";

export async function saveScoringWeights(db: Db, ctx: AuditContext, weights: ScoringWeights, now: Date) {
  await saveSetting(db, ctx, "scoringWeights", weights);
  const firms = await db
    .select({ id: company.id })
    .from(company)
    .where(and(eq(company.workspaceId, ctx.workspaceId), isNull(company.mergedIntoId)));
  await withAudit(db, ctx, { action: "update", entity: "company" }, async (tx) => {
    for (const f of firms) await rescoreCompany(tx, ctx, f.id, weights, "Scoring weights changed", now);
    return { result: null, after: { rescored: firms.length, reason: "Scoring weights changed" } };
  });
  return { rescored: firms.length };
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export async function saveBusinessHours(db: Db, ctx: AuditContext, hours: BusinessHours) {
  if (minutes(hours.end) <= minutes(hours.start))
    throw new Error("The end of the day must be after the start.");
  if (!hours.days.length) throw new Error("Pick at least one business day.");
  await saveSetting(db, ctx, "businessHours", hours);
  const shops = await db
    .select({ id: mysteryShop.id, sentAt: mysteryShop.sentAt, hoursBucket: mysteryShop.hoursBucket })
    .from(mysteryShop)
    .where(eq(mysteryShop.workspaceId, ctx.workspaceId));
  const moved = shops
    .map((s) => ({ ...s, next: hoursBucket(s.sentAt, hours) }))
    .filter((s) => s.next !== s.hoursBucket);
  if (moved.length) {
    await withAudit(db, ctx, { action: "update", entity: "mystery_shop" }, async (tx) => {
      for (const s of moved)
        await tx.update(mysteryShop).set({ hoursBucket: s.next }).where(eq(mysteryShop.id, s.id));
      return { result: null, after: { rebucketed: moved.length, reason: "Business hours changed" } };
    });
  }
  return { changed: moved.length };
}

export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface WeekInput {
  weekStart: string;
  mrr: number;
  cash: number | null;
  netBurn: number | null;
  paidClients: number;
  insuranceStudyHours: number;
  notes: string | null;
}

const money = (n: number | null) => (n === null ? null : n.toFixed(2));

/** One row per week (its Monday). Saving the same week again replaces it. */
export async function saveWeek(db: Db, ctx: AuditContext, input: WeekInput) {
  const weekStart = mondayOf(input.weekStart);
  const values = {
    mrr: input.mrr.toFixed(2),
    cash: money(input.cash),
    netBurn: money(input.netBurn),
    paidClients: input.paidClients,
    insuranceStudyHours: input.insuranceStudyHours.toFixed(1),
    notes: input.notes?.trim() || null,
  };
  return withAudit(db, ctx, { action: "update", entity: "weekly_metric" }, async (tx) => {
    const [row] = await tx
      .insert(weeklyMetric)
      .values({ workspaceId: ctx.workspaceId, createdById: ctx.userId, weekStart, ...values })
      .onConflictDoUpdate({
        target: [weeklyMetric.workspaceId, weeklyMetric.weekStart],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return { result: row!.id, entityId: row!.id, after: { weekStart, ...values } };
  });
}

// ---------------------------------------------------------------------------------------------
// Rule lists: added and turned off, never deleted, so old results still make sense.

type Software = (typeof softwarePattern.$inferInsert)["software"];

export async function addSoftwarePattern(
  db: Db,
  ctx: AuditContext,
  input: { software: Software; pattern: string; kind: "domain" | "substring" },
) {
  const pattern = input.pattern.trim().toLowerCase();
  if (!pattern) throw new Error("Enter a pattern.");
  return withAudit(db, ctx, { action: "create", entity: "software_pattern" }, async (tx) => {
    const [row] = await tx
      .insert(softwarePattern)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        software: input.software,
        pattern,
        kind: input.kind,
      })
      .returning();
    return { result: row!.id, entityId: row!.id, after: { ...input, pattern } };
  });
}

export async function setSoftwarePatternActive(db: Db, ctx: AuditContext, id: string, isActive: boolean) {
  return withAudit(db, ctx, { action: "update", entity: "software_pattern" }, async (tx) => {
    const rows = await tx
      .update(softwarePattern)
      .set({ isActive })
      .where(and(eq(softwarePattern.id, id), eq(softwarePattern.workspaceId, ctx.workspaceId)))
      .returning({ id: softwarePattern.id });
    if (!rows.length) throw new Error("Pattern not found.");
    return { result: null, entityId: id, after: { isActive } };
  });
}

export async function addExclusionRule(
  db: Db,
  ctx: AuditContext,
  input: {
    kind: "chain" | "not_a_fit";
    match: "name" | "domain" | "type";
    pattern: string;
    category: string | null;
  },
) {
  const pattern = input.pattern.trim();
  if (!pattern) throw new Error("Enter a name, domain or type to exclude.");
  return withAudit(db, ctx, { action: "create", entity: "exclusion_rule" }, async (tx) => {
    const [row] = await tx
      .insert(exclusionRule)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        kind: input.kind,
        match: input.match,
        pattern,
        category: input.category?.trim() || null,
      })
      .returning();
    return { result: row!.id, entityId: row!.id, after: { ...input, pattern } };
  });
}

export async function setExclusionRuleActive(db: Db, ctx: AuditContext, id: string, isActive: boolean) {
  return withAudit(db, ctx, { action: "update", entity: "exclusion_rule" }, async (tx) => {
    const rows = await tx
      .update(exclusionRule)
      .set({ isActive })
      .where(and(eq(exclusionRule.id, id), eq(exclusionRule.workspaceId, ctx.workspaceId)))
      .returning({ id: exclusionRule.id });
    if (!rows.length) throw new Error("Rule not found.");
    return { result: null, entityId: id, after: { isActive } };
  });
}
