export interface ShopTiming {
  sentAt: Date;
  firstReplyAt: Date | null;
}

export interface ShopStats {
  count: number;
  replied: number;
  /** Median over shops that got a reply. */
  medianRepliedMinutes: number | null;
  /** Median treating no-reply as "never answered" (Infinity). Never silently drops no-replies. */
  medianWithNoReplyMinutes: number | null;
  p75RepliedMinutes: number | null;
  p90RepliedMinutes: number | null;
  /** Share of shops old enough to judge that had no reply within 24h / 72h. */
  noReplyShare24h: number | null;
  noReplyShare72h: number | null;
}

const MINUTE = 60_000;

/** Linear-interpolated percentile (p in 0–1) of an ascending array. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return a + (b - a) * (pos - lo);
}

function noReplyShare(shops: ShopTiming[], now: Date, windowMinutes: number): number | null {
  const windowMs = windowMinutes * MINUTE;
  const eligible = shops.filter((s) => now.getTime() - s.sentAt.getTime() >= windowMs);
  if (eligible.length === 0) return null;
  const missed = eligible.filter(
    (s) => !s.firstReplyAt || s.firstReplyAt.getTime() - s.sentAt.getTime() > windowMs,
  );
  return missed.length / eligible.length;
}

export function shopStats(shops: ShopTiming[], now: Date): ShopStats {
  const replyMinutes = shops
    .filter((s): s is ShopTiming & { firstReplyAt: Date } => s.firstReplyAt !== null)
    .map((s) => (s.firstReplyAt.getTime() - s.sentAt.getTime()) / MINUTE)
    .sort((a, b) => a - b);
  const withNever = [
    ...replyMinutes,
    ...shops.filter((s) => !s.firstReplyAt).map(() => Number.POSITIVE_INFINITY),
  ];
  return {
    count: shops.length,
    replied: replyMinutes.length,
    medianRepliedMinutes: percentile(replyMinutes, 0.5),
    medianWithNoReplyMinutes: percentile(withNever, 0.5),
    p75RepliedMinutes: percentile(replyMinutes, 0.75),
    p90RepliedMinutes: percentile(replyMinutes, 0.9),
    noReplyShare24h: noReplyShare(shops, now, 24 * 60),
    noReplyShare72h: noReplyShare(shops, now, 72 * 60),
  };
}
