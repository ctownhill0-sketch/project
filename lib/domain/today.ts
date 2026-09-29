import { formatMinutes } from "@/lib/domain/scoring";

export interface FirmRef {
  companyId: string;
  name: string;
  town: string | null;
  score: number;
  why: string;
}

export interface TodayInputs {
  now: Date;
  /** Callbacks due by this time count as today's. */
  dueBy: Date;
  callbacks: (FirmRef & { dueAt: Date })[];
  /** Mystery shops still waiting for a first reply. */
  openShops: (FirmRef & { sentAt: Date })[];
  /** Callable firms not yet called, any order. */
  candidates: FirmRef[];
}

export type TodayKind = "callback" | "reply_check" | "top_score";

export interface TodayItem extends FirmRef {
  kind: TodayKind;
  reason: string;
}

const HOUR = 3_600_000;
export const CHECKPOINTS_H = [1, 4, 24, 72];
export const REPLY_CHECK_WINDOW_H = 24 * 7;

/**
 * Today's work, in the call workspace's order (brief M6): callbacks (overdue first),
 * reply checks, then the highest scores. One row per firm.
 */
export function buildToday(input: TodayInputs, limit: number, { dedupe = true } = {}) {
  const items: TodayItem[] = [];
  const seen = new Set<string>();
  const add = (item: TodayItem) => {
    if (dedupe && seen.has(item.companyId)) return;
    seen.add(item.companyId);
    items.push(item);
  };

  [...input.callbacks]
    .filter((c) => c.dueAt <= input.dueBy)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .forEach((c) =>
      add({
        ...c,
        kind: "callback",
        reason:
          c.dueAt < input.now
            ? `Callback overdue by ${formatMinutes((input.now.getTime() - c.dueAt.getTime()) / 60_000)}`
            : "Callback due today",
      }),
    );

  [...input.openShops]
    .map((s) => ({ s, ageH: (input.now.getTime() - s.sentAt.getTime()) / HOUR }))
    .filter(({ ageH }) => ageH >= 1 && ageH <= REPLY_CHECK_WINDOW_H)
    .sort((a, b) => b.ageH - a.ageH)
    .forEach(({ s, ageH }) => {
      const checkpoint = [...CHECKPOINTS_H].reverse().find((c) => ageH >= c) as number;
      add({ ...s, kind: "reply_check", reason: `${checkpoint}h reply check: no reply yet` });
    });

  [...input.candidates]
    .sort((a, b) => b.score - a.score)
    .forEach((c) => add({ ...c, kind: "top_score", reason: c.why }));

  return {
    items: items.slice(0, limit),
    totalDue: items.length,
    nextUp: items.find((i) => i.kind !== "reply_check") ?? null,
  };
}
