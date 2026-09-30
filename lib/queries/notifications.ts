import { and, desc, eq, gte, isNull, ne } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { call, company, mysteryShop } from "@/lib/db/schema";
import { nyDateKey } from "@/lib/domain/ny-time";
import { formatMinutes } from "@/lib/domain/scoring";
import { buildToday, type FirmRef } from "@/lib/domain/today";
import { listPilots } from "@/lib/pilots/service";
import { triageQueue } from "@/lib/queries/finder";

const DAY = 86_400_000;

const MAX_CALL_NOW = 5;

/**
 * Bell items: due callbacks and reply checks, call-now leads (a shop that went unanswered for 24h
 * and no call since), finder results waiting for triage, and pilots at risk. No lead is re-scored.
 */
export async function getNotifications(db: Db, workspaceId: string, now = new Date()) {
  const dueBy = new Date(now.getTime() + DAY / 2);
  const firmCols = { companyId: company.id, name: company.name, town: company.city, score: company.score };
  const live = and(eq(company.dncFlag, false), ne(company.status, "excluded"), isNull(company.mergedIntoId));
  // Independent reads run together: this renders with every page.
  const [calls, shops, pending, pilots] = await Promise.all([
    db
      .select({ ...firmCols, calledAt: call.calledAt, nextStepAt: call.nextStepAt })
      .from(call)
      .innerJoin(company, eq(company.id, call.companyId))
      .where(and(eq(call.workspaceId, workspaceId), live))
      .orderBy(desc(call.calledAt)),
    db
      .select({ ...firmCols, sentAt: mysteryShop.sentAt, firstReplyAt: mysteryShop.firstReplyAt })
      .from(mysteryShop)
      .innerJoin(company, eq(company.id, mysteryShop.companyId))
      .where(
        and(
          eq(mysteryShop.workspaceId, workspaceId),
          gte(mysteryShop.sentAt, new Date(now.getTime() - 30 * DAY)),
          live,
        ),
      )
      .orderBy(desc(mysteryShop.sentAt)),
    triageQueue(db, workspaceId, null),
    listPilots(db, workspaceId, nyDateKey(now), { runningOnly: true }),
  ]);

  // Only a firm's latest call decides its callback: a later call replaces the earlier plan.
  const latestCall = new Map<string, (typeof calls)[number]>();
  for (const c of calls) if (!latestCall.has(c.companyId)) latestCall.set(c.companyId, c);
  const ref = (r: Omit<FirmRef, "why">): FirmRef => ({ ...r, why: "" });
  const callbacks = [...latestCall.values()]
    .filter((c): c is typeof c & { nextStepAt: Date } => c.nextStepAt !== null && c.nextStepAt <= dueBy)
    .map((c) => ({ ...ref(c), dueAt: c.nextStepAt }));
  const openShops = shops
    .filter((sh) => !sh.firstReplyAt && sh.sentAt >= new Date(now.getTime() - 7 * DAY))
    .map((sh) => ({ ...ref(sh), sentAt: sh.sentAt }));
  const today = buildToday({ now, dueBy, callbacks, openShops, candidates: [] }, 8, { dedupe: false });

  // Call now: the shop is the proof. Replied late or never, and not called since it was sent.
  const seen = new Set<string>();
  const callNow = shops.filter((sh) => {
    const old = sh.sentAt.getTime() <= now.getTime() - DAY;
    const late = !sh.firstReplyAt || sh.firstReplyAt.getTime() - sh.sentAt.getTime() > DAY;
    const lastCalled = latestCall.get(sh.companyId)?.calledAt;
    if (!old || !late || (lastCalled && lastCalled >= sh.sentAt) || seen.has(sh.companyId)) return false;
    seen.add(sh.companyId);
    return true;
  });
  const atRisk = pilots.filter((p) => p.vacancies.some((v) => v.guarantee.status === "at_risk"));

  const extra = [
    ...callNow.slice(0, MAX_CALL_NOW).map((sh) => ({
      kind: "call_now",
      name: sh.name,
      label: sh.firstReplyAt
        ? `Took ${formatMinutes((sh.firstReplyAt.getTime() - sh.sentAt.getTime()) / 60_000)} to reply. Call with the proof.`
        : "No reply in 24h to your inquiry. Call with the proof.",
      href: `/calls?lead=${sh.companyId}`,
    })),
    ...(pending.length
      ? [
          {
            kind: "finder",
            name: "Lead finder",
            label: `${pending.length} ${pending.length === 1 ? "place" : "places"} waiting for triage`,
            href: "/finder/triage",
          },
        ]
      : []),
    ...atRisk.map((p) => ({
      kind: "pilot_at_risk",
      name: p.firmName,
      label: `Pilot at risk on day ${p.day}. Check the scorecard.`,
      href: "/pilots",
    })),
  ];
  return {
    total: today.totalDue + extra.length,
    items: today.items
      .map((i): { kind: string; name: string; label: string; href: string } => ({
        kind: i.kind,
        name: i.name,
        label: i.reason,
        href: `/leads?lead=${i.companyId}`,
      }))
      .concat(extra),
  };
}
