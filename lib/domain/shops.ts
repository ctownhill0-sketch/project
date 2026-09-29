// Mystery-shop rules (brief M4). Ethics: at most one shop per firm per 30 days.
import type { HoursBucket } from "@/lib/domain/hours";
import { shopStats, type ShopStats, type ShopTiming } from "@/lib/domain/shop-stats";

export const SHOP_COOLDOWN_DAYS = 30;
const DAY = 86_400_000;

/** When the firm may be shopped again, or null if it can be shopped now (never shopped). */
export function nextAllowedShopAt(lastSentAt: Date | null): Date | null {
  return lastSentAt ? new Date(lastSentAt.getTime() + SHOP_COOLDOWN_DAYS * DAY) : null;
}

/** A reply can't come before the inquiry or after now. */
export function replyTimeProblem(sentAt: Date, repliedAt: Date, now: Date): string | null {
  if (repliedAt.getTime() < sentAt.getTime()) return "The reply time is before the inquiry was sent.";
  if (repliedAt.getTime() > now.getTime() + 60_000) return "The reply time is in the future.";
  return null;
}

export function statsByBucket(
  shops: (ShopTiming & { hoursBucket: HoursBucket })[],
  now: Date,
): Record<HoursBucket | "all", ShopStats> {
  const pick = (b: HoursBucket) => shops.filter((s) => s.hoursBucket === b);
  return {
    all: shopStats(shops, now),
    business: shopStats(pick("business"), now),
    saturday: shopStats(pick("saturday"), now),
    after_hours: shopStats(pick("after_hours"), now),
  };
}
