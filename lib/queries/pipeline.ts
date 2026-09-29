import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { company, deal, pipelineStage, stageEvent } from "@/lib/db/schema";
import { nyMonthStart } from "@/lib/domain/ny-time";

const DAY = 86_400_000;
/** Closed deals stay on the board for this long. */
const CLOSED_WINDOW_DAYS = 90;

export async function pipelineBoard(db: Db, workspaceId: string, now: Date) {
  const [stages, deals] = await Promise.all([
    db
      .select()
      .from(pipelineStage)
      .where(eq(pipelineStage.workspaceId, workspaceId))
      .orderBy(asc(pipelineStage.position)),
    db
      .select({ deal, companyName: company.name, city: company.city })
      .from(deal)
      .innerJoin(company, eq(company.id, deal.companyId))
      .where(eq(deal.workspaceId, workspaceId)),
  ]);
  const visible = deals.filter(
    (d) => !d.deal.closedAt || now.getTime() - d.deal.closedAt.getTime() <= CLOSED_WINDOW_DAYS * DAY,
  );
  const events = visible.length
    ? await db
        .select()
        .from(stageEvent)
        .where(
          inArray(
            stageEvent.dealId,
            visible.map((d) => d.deal.id),
          ),
        )
        .orderBy(asc(stageEvent.movedAt))
    : [];
  const name = new Map(stages.map((s) => [s.id, s.name]));
  const cards = visible.map(({ deal: d, companyName, city }) => {
    const history = events.filter((e) => e.dealId === d.id);
    const enteredAt = history.at(-1)?.movedAt ?? d.createdAt;
    return {
      id: d.id,
      companyId: d.companyId,
      companyName,
      city,
      stageId: d.stageId,
      vacancies: d.vacancies,
      probability: d.probability,
      expectedMrr: Number(d.expectedMrr),
      lostReason: d.lostReason,
      closedAt: d.closedAt,
      daysInStage: Math.floor((now.getTime() - enteredAt.getTime()) / DAY),
      history: history.map((e) => ({
        from: e.fromStageId ? (name.get(e.fromStageId) ?? null) : null,
        to: name.get(e.toStageId) ?? "?",
        movedAt: e.movedAt,
      })),
    };
  });
  const open = cards.filter((c) => !c.closedAt);
  const lostStage = stages.find((s) => s.isLost);
  const wonStage = stages.find((s) => s.isWon);
  const monthStart = nyMonthStart(now);
  return {
    stages: stages.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      probability: s.probability,
      isWon: s.isWon,
      isLost: s.isLost,
      deals: cards
        .filter((c) => c.stageId === s.id)
        .sort((a, b) => b.expectedMrr - a.expectedMrr || a.companyName.localeCompare(b.companyName)),
    })),
    totals: {
      open: open.length,
      expectedMrr: Math.round(open.reduce((sum, c) => sum + c.expectedMrr, 0) * 100) / 100,
      wonThisMonth: cards.filter((c) => c.stageId === wonStage?.id && c.closedAt && c.closedAt >= monthStart)
        .length,
      lostThisMonth: cards.filter(
        (c) => c.stageId === lostStage?.id && c.closedAt && c.closedAt >= monthStart,
      ).length,
    },
  };
}
