import { and, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { call, company, mysteryShop } from "@/lib/db/schema";
import { buildToday, type FirmRef } from "@/lib/domain/today";

const DAY = 86_400_000;

/** Bell items: due callbacks and reply checks (cheap: no scoring of every lead). */
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
  return {
    total: today.totalDue,
    items: today.items.map((i) => ({
      kind: i.kind,
      name: i.name,
      label: i.reason,
      href: `/leads?lead=${i.companyId}`,
    })),
  };
}
