import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { company, mysteryShop } from "@/lib/db/schema";
import { nyDayStart } from "@/lib/domain/ny-time";
import { nextAllowedShopAt, statsByBucket } from "@/lib/domain/shops";
import { CHECKPOINTS_H, REPLY_CHECK_WINDOW_H } from "@/lib/domain/today";

const HOUR = 3_600_000;

export async function shopsOverview(db: Db, workspaceId: string, now: Date) {
  const rows = await db
    .select({
      id: mysteryShop.id,
      companyId: mysteryShop.companyId,
      companyName: company.name,
      city: company.city,
      channel: mysteryShop.channel,
      sentAt: mysteryShop.sentAt,
      hoursBucket: mysteryShop.hoursBucket,
      firstReplyAt: mysteryShop.firstReplyAt,
      replyType: mysteryShop.replyType,
      tourOffered: mysteryShop.tourOffered,
    })
    .from(mysteryShop)
    .innerJoin(company, eq(company.id, mysteryShop.companyId))
    .where(eq(mysteryShop.workspaceId, workspaceId))
    .orderBy(desc(mysteryShop.sentAt));
  const shops = rows.map((r) => ({
    ...r,
    replyMinutes: r.firstReplyAt
      ? Math.round((r.firstReplyAt.getTime() - r.sentAt.getTime()) / 60_000)
      : null,
  }));
  const replyChecks = shops
    .filter((s) => !s.firstReplyAt)
    .map((s) => ({ ...s, ageH: (now.getTime() - s.sentAt.getTime()) / HOUR }))
    .filter((s) => s.ageH >= 1 && s.ageH <= REPLY_CHECK_WINDOW_H)
    .sort((a, b) => b.ageH - a.ageH)
    .map((s) => {
      const checkpointHours = [...CHECKPOINTS_H].reverse().find((c) => s.ageH >= c)!;
      const next = CHECKPOINTS_H.find((c) => c > s.ageH);
      return {
        shopId: s.id,
        companyId: s.companyId,
        companyName: s.companyName,
        sentAt: s.sentAt,
        checkpointHours,
        nextCheckAt: next ? new Date(s.sentAt.getTime() + next * HOUR) : null,
      };
    });
  const weekStart = new Date(nyDayStart(now).getTime() - 6 * 24 * HOUR);
  return {
    shops: shops.slice(0, 200),
    total: shops.length,
    stats: statsByBucket(shops, now),
    replyChecks,
    thisWeek: shops.filter((s) => s.sentAt >= weekStart).length,
  };
}

/** "Plan mystery shops": the chosen firms (or the top new leads), each with its rentals link. Never do-not-call. */
export async function shopPlan(db: Db, workspaceId: string, ids: string[] | null, now: Date, topN = 10) {
  const base = and(
    eq(company.workspaceId, workspaceId),
    isNull(company.mergedIntoId),
    eq(company.dncFlag, false),
  );
  const firms = ids?.length
    ? await db
        .select()
        .from(company)
        .where(and(base, inArray(company.id, ids)))
        .orderBy(desc(company.score))
    : await db
        .select()
        .from(company)
        .where(and(base, eq(company.status, "new")))
        .orderBy(desc(company.score))
        .limit(topN);
  if (firms.length === 0) return [];
  const shops = await db
    .select({ companyId: mysteryShop.companyId, sentAt: mysteryShop.sentAt })
    .from(mysteryShop)
    .where(
      and(
        inArray(
          mysteryShop.companyId,
          firms.map((f) => f.id),
        ),
        gte(mysteryShop.sentAt, new Date(now.getTime() - 30 * 24 * HOUR)),
      ),
    )
    .orderBy(desc(mysteryShop.sentAt));
  return firms.map((f) => {
    const last = shops.find((s) => s.companyId === f.id)?.sentAt ?? null;
    return {
      id: f.id,
      name: f.name,
      city: f.city,
      score: f.score,
      link: f.availableRentalsUrl ?? f.websiteUrl,
      done: last !== null,
      lastShopAt: last,
      nextAllowedAt: nextAllowedShopAt(last),
    };
  });
}
