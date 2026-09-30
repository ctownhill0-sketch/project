import { and, desc, eq, gte, isNotNull, isNull, lte, ne } from "drizzle-orm";
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
  const callbacks = await db
    .select({
      companyId: call.companyId,
      name: company.name,
      town: company.city,
      score: company.score,
      dueAt: call.nextStepAt,
    })
    .from(call)
    .innerJoin(company, eq(company.id, call.companyId))
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        isNotNull(call.nextStepAt),
        lte(call.nextStepAt, dueBy),
        eq(company.dncFlag, false),
      ),
    )
    .orderBy(desc(call.calledAt));
  const open = await db
    .select({
      companyId: mysteryShop.companyId,
      name: company.name,
      town: company.city,
      score: company.score,
      sentAt: mysteryShop.sentAt,
    })
    .from(mysteryShop)
    .innerJoin(company, eq(company.id, mysteryShop.companyId))
    .where(
      and(
        eq(mysteryShop.workspaceId, workspaceId),
        isNull(mysteryShop.firstReplyAt),
        gte(mysteryShop.sentAt, new Date(now.getTime() - 7 * DAY)),
      ),
    );
  const ref = (r: Omit<FirmRef, "why">): FirmRef => ({ ...r, why: "" });
  const today = buildToday(
    {
      now,
      dueBy,
      callbacks: callbacks.map((c) => ({ ...ref(c), dueAt: c.dueAt as Date })),
      openShops: open.map((s) => ({ ...ref(s), sentAt: s.sentAt })),
      candidates: [],
    },
    8,
    { dedupe: false },
  );
  // Call now: the shop is the proof. Replied late or never, and not called since it was sent.
  const shopsForProof = await db
    .select({
      companyId: mysteryShop.companyId,
      name: company.name,
      sentAt: mysteryShop.sentAt,
      firstReplyAt: mysteryShop.firstReplyAt,
    })
    .from(mysteryShop)
    .innerJoin(company, eq(company.id, mysteryShop.companyId))
    .where(
      and(
        eq(mysteryShop.workspaceId, workspaceId),
        lte(mysteryShop.sentAt, new Date(now.getTime() - DAY)),
        gte(mysteryShop.sentAt, new Date(now.getTime() - 30 * DAY)),
        eq(company.dncFlag, false),
        ne(company.status, "excluded"),
        isNull(company.mergedIntoId),
      ),
    )
    .orderBy(desc(mysteryShop.sentAt));
  const calls = await db
    .select({ companyId: call.companyId, calledAt: call.calledAt })
    .from(call)
    .where(eq(call.workspaceId, workspaceId));
  const seen = new Set<string>();
  const callNow = shopsForProof.filter((s) => {
    const late = !s.firstReplyAt || s.firstReplyAt.getTime() - s.sentAt.getTime() > DAY;
    const calledSince = calls.some((c) => c.companyId === s.companyId && c.calledAt >= s.sentAt);
    if (!late || calledSince || seen.has(s.companyId)) return false;
    seen.add(s.companyId);
    return true;
  });

  const [pending, pilots] = await Promise.all([
    triageQueue(db, workspaceId, null),
    listPilots(db, workspaceId, nyDateKey(now)),
  ]);
  const atRisk = pilots.filter(
    (p) => p.status === "running" && p.vacancies.some((v) => v.guarantee.status === "at_risk"),
  );

  const extra = [
    ...callNow.slice(0, MAX_CALL_NOW).map((s) => ({
      kind: "call_now",
      name: s.name,
      label: s.firstReplyAt
        ? `Took ${formatMinutes((s.firstReplyAt.getTime() - s.sentAt.getTime()) / 60_000)} to reply. Call with the proof.`
        : "No reply in 24h to your inquiry. Call with the proof.",
      href: `/calls?lead=${s.companyId}`,
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
