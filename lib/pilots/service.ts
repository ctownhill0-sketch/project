// Pilots (brief M10): start a 14-day pilot, enter each vacancy's numbers by hand each day, and
// judge the guarantee. Everything the founder changes goes through withAudit.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { client, company, pilot, pilotMetric, vacancy } from "@/lib/db/schema";
import {
  addDays,
  daysElapsed,
  DEFAULT_GUARANTEE,
  pilotOutcome,
  vacancyGuarantee,
  type GuaranteeRules,
} from "@/lib/domain/guarantee";
import { getSetting } from "@/lib/queries/settings";

async function rulesFor(db: Db, workspaceId: string): Promise<GuaranteeRules> {
  return {
    ...DEFAULT_GUARANTEE,
    ...(await getSetting<Partial<GuaranteeRules>>(db, workspaceId, "guarantee", {})),
  };
}

export interface StartPilotInput {
  companyId: string;
  day0: string;
  vacancies: { label: string; baselineDaysOnMarket: number | null }[];
}

export async function startPilot(db: Db, ctx: AuditContext, input: StartPilotInput): Promise<string> {
  const rules = await rulesFor(db, ctx.workspaceId);
  const labels = input.vacancies.map((v) => ({ ...v, label: v.label.trim() })).filter((v) => v.label);
  if (!labels.length) throw new Error("Add at least one vacancy.");
  return withAudit(db, ctx, { action: "create", entity: "pilot" }, async (tx) => {
    const [firm] = await tx
      .select()
      .from(company)
      .where(and(eq(company.id, input.companyId), eq(company.workspaceId, ctx.workspaceId)));
    if (!firm) throw new Error("Lead not found.");
    const running = await tx
      .select({ id: pilot.id })
      .from(pilot)
      .innerJoin(client, eq(client.id, pilot.clientId))
      .where(and(eq(client.companyId, firm.id), eq(pilot.status, "running")));
    if (running.length) throw new Error(`${firm.name} already has a running pilot.`);
    const own = { workspaceId: ctx.workspaceId, createdById: ctx.userId };
    const [existing] = await tx.select().from(client).where(eq(client.companyId, firm.id)).limit(1);
    const clientRow =
      existing ??
      (
        await tx
          .insert(client)
          .values({ ...own, companyId: firm.id, status: "pilot", startedOn: input.day0 })
          .returning()
      )[0]!;
    const [p] = await tx
      .insert(pilot)
      .values({ ...own, clientId: clientRow.id, day0: input.day0, tourTarget: rules.tourTarget })
      .returning();
    await tx.insert(vacancy).values(
      labels.map((v) => ({
        ...own,
        clientId: clientRow.id,
        label: v.label,
        baselineDaysOnMarket: v.baselineDaysOnMarket,
      })),
    );
    return {
      result: p!.id,
      entityId: p!.id,
      after: { companyId: firm.id, day0: input.day0, vacancies: labels.length },
    };
  });
}

export const MetricRow = z.object({
  vacancyId: z.uuid(),
  inquiries: z.number().int().min(0).max(10_000),
  medianReplySeconds: z.number().int().min(0).max(10_000_000).nullable(),
  p90ReplySeconds: z.number().int().min(0).max(10_000_000).nullable(),
  tours: z.number().int().min(0).max(1_000),
  applications: z.number().int().min(0).max(1_000),
  escalations: z.number().int().min(0).max(1_000),
  fairHousingFlags: z.number().int().min(0).max(1_000),
  humanMinutes: z.number().int().min(0).max(1_440),
});
export type MetricRow = z.infer<typeof MetricRow>;

export async function saveDayMetrics(
  db: Db,
  ctx: AuditContext,
  input: { pilotId: string; day: string; rows: MetricRow[] },
  today: string,
) {
  const rules = await rulesFor(db, ctx.workspaceId);
  const rows = z.array(MetricRow).min(1).parse(input.rows);
  const [p] = await db
    .select()
    .from(pilot)
    .where(and(eq(pilot.id, input.pilotId), eq(pilot.workspaceId, ctx.workspaceId)));
  if (!p) throw new Error("Pilot not found.");
  const last = addDays(p.day0, rules.pilotDays - 1);
  if (input.day < p.day0 || input.day > last) throw new Error(`Pick a day between ${p.day0} and ${last}.`);
  if (input.day > today) throw new Error("That day is in the future.");
  const allowed = new Set(
    (await db.select({ id: vacancy.id }).from(vacancy).where(eq(vacancy.clientId, p.clientId))).map(
      (v) => v.id,
    ),
  );
  if (rows.some((r) => !allowed.has(r.vacancyId))) throw new Error("That vacancy isn't part of this pilot.");
  await withAudit(db, ctx, { action: "update", entity: "pilot_metric" }, async (tx) => {
    for (const r of rows) {
      const { vacancyId, ...values } = r;
      await tx
        .insert(pilotMetric)
        .values({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          pilotId: p.id,
          vacancyId,
          day: input.day,
          ...values,
        })
        .onConflictDoUpdate({
          target: [pilotMetric.vacancyId, pilotMetric.day],
          set: { ...values, updatedAt: new Date() },
        });
    }
    return { result: null, entityId: p.id, after: { day: input.day, rows } };
  });
}

/** From day 14 the pilot is closed as met (every vacancy met) or missed. */
export async function closePilot(db: Db, ctx: AuditContext, pilotId: string, today: string) {
  const [listed] = (await listPilots(db, ctx.workspaceId, today)).filter((p) => p.id === pilotId);
  if (!listed) throw new Error("Pilot not found.");
  if (listed.status !== "running") throw new Error("This pilot is already closed.");
  if (listed.elapsed < listed.rules.pilotDays)
    throw new Error(`A pilot can be closed from day ${listed.rules.pilotDays}.`);
  const outcome = pilotOutcome(listed.vacancies.map((v) => v.guarantee.status));
  await withAudit(db, ctx, { action: "update", entity: "pilot" }, async (tx) => {
    await tx.update(pilot).set({ status: outcome }).where(eq(pilot.id, pilotId));
    return { result: null, entityId: pilotId, before: { status: "running" }, after: { status: outcome } };
  });
  return outcome;
}

export async function listPilots(db: Db, workspaceId: string, today: string) {
  const settings = await rulesFor(db, workspaceId);
  const pilots = await db
    .select({ pilot, firmName: company.name, companyId: company.id })
    .from(pilot)
    .innerJoin(client, eq(client.id, pilot.clientId))
    .innerJoin(company, eq(company.id, client.companyId))
    .where(eq(pilot.workspaceId, workspaceId))
    .orderBy(desc(pilot.day0), asc(company.name));
  if (!pilots.length) return [];
  const clientIds = [...new Set(pilots.map((p) => p.pilot.clientId))];
  const [vacancies, metrics] = await Promise.all([
    db.select().from(vacancy).where(inArray(vacancy.clientId, clientIds)).orderBy(asc(vacancy.label)),
    db
      .select()
      .from(pilotMetric)
      .where(
        inArray(
          pilotMetric.pilotId,
          pilots.map((p) => p.pilot.id),
        ),
      )
      .orderBy(asc(pilotMetric.day)),
  ]);
  return pilots.map(({ pilot: p, firmName, companyId }) => {
    const rules = { ...settings, tourTarget: p.tourTarget };
    const lastDay = addDays(p.day0, rules.pilotDays - 1);
    const elapsed = Math.max(0, daysElapsed(p.day0, today));
    const mine = metrics.filter((m) => m.pilotId === p.id && m.day <= lastDay);
    return {
      id: p.id,
      companyId,
      firmName,
      day0: p.day0,
      lastDay,
      status: p.status,
      elapsed,
      day: Math.min(elapsed, rules.pilotDays),
      rules,
      vacancies: vacancies
        .filter((v) => v.clientId === p.clientId)
        .map((v) => {
          const days = mine.filter((m) => m.vacancyId === v.id);
          return {
            id: v.id,
            label: v.label,
            baselineDaysOnMarket: v.baselineDaysOnMarket,
            metrics: days,
            guarantee: vacancyGuarantee(days, elapsed, rules),
          };
        }),
    };
  });
}

export type PilotView = Awaited<ReturnType<typeof listPilots>>[number];
