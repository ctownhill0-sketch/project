import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  appUser,
  call,
  company,
  contact,
  mysteryShop,
  objection,
  roiScenario,
  script,
} from "@/lib/db/schema";
import { buildCallList, fillScript, type CallCandidate, type Disposition } from "@/lib/domain/calls";
import { nyDayStart } from "@/lib/domain/ny-time";
import { formatMinutes, softwareLabel, whyThisLead, type Software } from "@/lib/domain/scoring";
import { leadFacts, groupBy } from "@/lib/queries/facts";
import { getLeadDetail } from "@/lib/queries/leads";
import { getSetting } from "@/lib/queries/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

const TZ = "America/New_York";
const DAY = 86_400_000;
const SLOW_MINUTES = 120;

/** Today's call list: callbacks due, then firms with a fresh slow/no-reply shop, then highest score. */
export async function callList(db: Db, workspaceId: string, now: Date) {
  const [firms, calls, shops] = await Promise.all([
    db
      .select()
      .from(company)
      .where(and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId))),
    db.select().from(call).where(eq(call.workspaceId, workspaceId)).orderBy(desc(call.calledAt)),
    db
      .select({
        companyId: mysteryShop.companyId,
        sentAt: mysteryShop.sentAt,
        firstReplyAt: mysteryShop.firstReplyAt,
      })
      .from(mysteryShop)
      .where(eq(mysteryShop.workspaceId, workspaceId)),
  ]);
  const callsBy = groupBy(calls, (c) => c.companyId);
  const shopsBy = groupBy(shops, (s) => s.companyId);
  const candidates: CallCandidate[] = firms.map((f) => {
    const last = callsBy.get(f.id)?.[0];
    const own = shopsBy.get(f.id) ?? [];
    const lastCalledAt = last?.calledAt ?? null;
    const callNow = own.some((s) => {
      if (lastCalledAt && s.sentAt <= lastCalledAt) return false;
      if (now.getTime() - s.sentAt.getTime() > 14 * DAY) return false;
      if (!s.firstReplyAt) return now.getTime() - s.sentAt.getTime() >= DAY;
      return (s.firstReplyAt.getTime() - s.sentAt.getTime()) / 60_000 > SLOW_MINUTES;
    });
    return {
      companyId: f.id,
      name: f.name,
      town: f.city,
      score: f.score,
      why: whyThisLead(leadFacts(f, own, now)),
      phone: f.phone,
      dnc: f.dncFlag,
      excluded: f.status === "excluded" || f.status === "archived",
      lastCalledAt,
      nextStepAt: last?.nextStepAt ?? null,
      callNow,
      lastDisposition: (last?.disposition as Disposition | undefined) ?? null,
    };
  });
  return buildCallList({ now, firms: candidates });
}

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ }).format(d);

/** Everything for one call, from the firm's own data only. AI-HOOK(M5): a Claude brief slots in here. */
export async function callPrep(db: Db, workspaceId: string, companyId: string, now: Date) {
  const lead = await getLeadDetail(db, workspaceId, companyId, now);
  if (!lead) return null;
  const [scripts, objections, people, roi, founderSetting, guarantee] = await Promise.all([
    db
      .select()
      .from(script)
      .where(and(eq(script.workspaceId, workspaceId), eq(script.isActive, true)))
      .orderBy(asc(script.kind)),
    db
      .select()
      .from(objection)
      .where(eq(objection.workspaceId, workspaceId))
      .orderBy(desc(objection.timesHeard), asc(objection.title)),
    db.select().from(contact).where(eq(contact.companyId, companyId)).orderBy(desc(contact.isDecisionMaker)),
    db
      .select()
      .from(roiScenario)
      .where(and(eq(roiScenario.workspaceId, workspaceId), eq(roiScenario.companyId, companyId)))
      .orderBy(desc(roiScenario.createdAt))
      .limit(1),
    getSetting<string | null>(db, workspaceId, "shopperName", null),
    getSetting(db, workspaceId, "guarantee", DEFAULT_SETTINGS.guarantee as { tourTarget: number }),
  ]);
  const latestShop = lead.shops[0];
  const replyTime = latestShop
    ? latestShop.firstReplyAt
      ? formatMinutes((latestShop.firstReplyAt.getTime() - latestShop.sentAt.getTime()) / 60_000)
      : `no reply after ${formatMinutes((now.getTime() - latestShop.sentAt.getTime()) / 60_000)}`
    : null;
  const vars = {
    founderName: founderSetting,
    firmName: lead.name,
    contactName: people.find((p) => !p.doNotCall)?.name ?? null,
    shopDate: latestShop ? day(latestShop.sentAt) : null,
    replyTime,
    tourTarget: guarantee.tourTarget,
    town: lead.city,
    software: softwareLabel(lead.software as Software),
    units: lead.estUnits,
    listings: lead.liveListingsCount,
  };
  if (!vars.founderName) {
    const [u] = await db.select({ name: appUser.name }).from(appUser).limit(1);
    vars.founderName = u?.name ?? null;
  }
  return {
    lead,
    vars,
    scripts: scripts.map((s) => ({ id: s.id, kind: s.kind, name: s.name, filled: fillScript(s.body, vars) })),
    objections: objections.map((o) => ({
      id: o.id,
      title: o.title,
      timesHeard: o.timesHeard,
      filled: fillScript(o.response, vars),
    })),
    roi: roi[0] ?? null,
    openNextStep: lead.calls.find((c) => c.nextStepAt && c.nextStepAt > now) ?? null,
  };
}

export async function callStats(db: Db, workspaceId: string, now: Date) {
  const [week] = await db
    .select({
      conversations: sql<number>`count(*) filter (where ${call.isDecisionMakerConversation})::int`,
    })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        sql`(${call.calledAt} at time zone ${TZ})::date >= date_trunc('week', (${now.toISOString()}::timestamptz at time zone ${TZ}))::date`,
      ),
    );
  const [today] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        sql`${call.calledAt} >= ${nyDayStart(now).toISOString()}::timestamptz`,
      ),
    );
  const latest = await db
    .selectDistinctOn([call.companyId], { companyId: call.companyId, nextStepAt: call.nextStepAt })
    .from(call)
    .where(eq(call.workspaceId, workspaceId))
    .orderBy(call.companyId, desc(call.calledAt));
  const callbacksDue = latest.filter((c) => c.nextStepAt && c.nextStepAt <= now).length;
  return { today: today?.n ?? 0, conversationsThisWeek: week?.conversations ?? 0, callbacksDue };
}
