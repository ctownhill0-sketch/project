import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { call, company, mysteryShop, pilot, weeklyMetric } from "@/lib/db/schema";
import { firstRunChecklist } from "@/lib/domain/first-run";
import { nyDateKey } from "@/lib/domain/ny-time";
import { placesKeyStatus } from "@/lib/finder/runtime";
import { DEMO_WEEK_NOTE, isDemoFirm } from "@/lib/seed/markers";
import { mondayOf } from "@/lib/settings/service";
import { killTestProgress, projection, weekOverWeek, type KillTestSettings } from "@/lib/domain/progress";
import { whyThisLead } from "@/lib/domain/scoring";
import { shopStats } from "@/lib/domain/shop-stats";
import { buildToday, type FirmRef } from "@/lib/domain/today";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { groupBy, leadFacts } from "@/lib/queries/facts";
import { getSetting } from "@/lib/queries/settings";

const TZ = "America/New_York";

/** Milliseconds until midnight in New York. */
function endOfDayNY(now: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const minutesLeft = 24 * 60 - (Number(parts.hour) * 60 + Number(parts.minute));
  return new Date(now.getTime() + minutesLeft * 60_000);
}

export async function getDashboard(db: Db, workspaceId: string, now = new Date()) {
  const killSettings = await getSetting<KillTestSettings>(
    db,
    workspaceId,
    "killTest",
    DEFAULT_SETTINGS.killTest as KillTestSettings,
  );

  const weeks = await db
    .select()
    .from(weeklyMetric)
    .where(eq(weeklyMetric.workspaceId, workspaceId))
    .orderBy(asc(weeklyMetric.weekStart));
  const mrrValues = weeks.map((w) => Number(w.mrr));
  const mrr = mrrValues.at(-1) ?? null;

  const [weekCalls] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      conversations: sql<number>`count(*) filter (where ${call.isDecisionMakerConversation})::int`,
    })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        sql`(${call.calledAt} at time zone ${TZ})::date >= date_trunc('week', (${now.toISOString()}::timestamptz at time zone ${TZ}))::date`,
      ),
    );
  const [sinceStart] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        eq(call.isDecisionMakerConversation, true),
        sql`(${call.calledAt} at time zone ${TZ})::date >= ${killSettings.day0}::date`,
      ),
    );
  const [pilots] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pilot)
    .where(and(eq(pilot.workspaceId, workspaceId), inArray(pilot.status, ["running", "met"])));

  const shops = await db.select().from(mysteryShop).where(eq(mysteryShop.workspaceId, workspaceId));
  const afterHours = shopStats(
    shops.filter((s) => s.hoursBucket === "after_hours"),
    now,
  );

  const firms = await db
    .select()
    .from(company)
    .where(and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId)));
  const shopsByFirm = groupBy(shops, (s) => s.companyId);
  const refs = new Map<string, FirmRef>(
    firms.map((f) => [
      f.id,
      {
        companyId: f.id,
        name: f.name,
        town: f.city,
        score: f.score,
        why: whyThisLead(leadFacts(f, shopsByFirm.get(f.id) ?? [], now)),
      },
    ]),
  );
  const callable = firms.filter((f) => f.status !== "excluded" && !f.dncFlag && f.score > 0);
  const callableIds = new Set(callable.map((f) => f.id));

  const allCalls = await db
    .select()
    .from(call)
    .where(eq(call.workspaceId, workspaceId))
    .orderBy(desc(call.calledAt));
  const called = new Set(allCalls.map((c) => c.companyId));
  const latestPerFirm = [...groupBy(allCalls, (c) => c.companyId).values()].map((list) => list[0]!);
  const callbacks = latestPerFirm
    .filter((c) => c.nextStepAt && callableIds.has(c.companyId))
    .map((c) => ({ ...refs.get(c.companyId)!, dueAt: c.nextStepAt as Date }));
  const openShops = shops
    .filter((s) => !s.firstReplyAt && callableIds.has(s.companyId))
    .map((s) => ({ ...refs.get(s.companyId)!, sentAt: s.sentAt }));
  const candidates = callable.filter((f) => !called.has(f.id)).map((f) => refs.get(f.id)!);
  const today = buildToday({ now, dueBy: endOfDayNY(now), callbacks, openShops, candidates }, 12);

  const demoIds = new Set(firms.filter(isDemoFirm).map((f) => f.id));
  const thisMonday = mondayOf(nyDateKey(now));
  const firstRun = firstRunChecklist({
    shopperNameSet: Boolean(await getSetting<string | null>(db, workspaceId, "shopperName", null)),
    placesKeySet: placesKeyStatus().configured,
    demoFirmsLeft: demoIds.size,
    realLeads: firms.length - demoIds.size,
    realShops: shops.filter((s) => !demoIds.has(s.companyId)).length,
    realCalls: allCalls.filter((c) => !demoIds.has(c.companyId)).length,
    thisWeekEntered: weeks.some((w) => w.weekStart === thisMonday && w.notes !== DEMO_WEEK_NOTE),
  });

  const nextUpFirm = today.nextUp ? firms.find((f) => f.id === today.nextUp!.companyId) : undefined;
  return {
    mrr,
    wow: weekOverWeek(mrrValues),
    callsThisWeek: weekCalls?.calls ?? 0,
    conversationsThisWeek: weekCalls?.conversations ?? 0,
    killTest: {
      ...killTestProgress(killSettings, now, {
        pilots: pilots?.n ?? 0,
        conversations: sinceStart?.n ?? 0,
        afterHoursMedianMinutes: afterHours.medianWithNoReplyMinutes,
      }),
      targets: killSettings,
      afterHoursShops: afterHours.count,
    },
    today,
    firstRun,
    nextUp: today.nextUp ? { ...today.nextUp, phone: nextUpFirm?.phone ?? null } : null,
    mrrSeries: weeks.map((w) => ({ weekStart: w.weekStart, mrr: Number(w.mrr) })),
    projection:
      mrr === null
        ? []
        : projection(mrr, 4, 0.07).map((v, i) => ({
            weekStart: addWeeks(weeks.at(-1)!.weekStart, i),
            mrr: v,
          })),
  };
}

function addWeeks(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
