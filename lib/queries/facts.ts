import type { company, mysteryShop } from "@/lib/db/schema";
import type { LeadFacts, Software } from "@/lib/domain/scoring";
import { shopStats } from "@/lib/domain/shop-stats";

type Company = typeof company.$inferSelect;
type Shop = Pick<typeof mysteryShop.$inferSelect, "sentAt" | "firstReplyAt">;

/** The scoring/why-line facts for a firm, from its row and its shops. */
export function leadFacts(firm: Company, shops: Shop[], now: Date): LeadFacts {
  const stats = shopStats(shops, now);
  return {
    software: (firm.softwareOverride ?? firm.detectedSoftware) as Software,
    units: firm.estUnits,
    liveListings: firm.liveListingsCount,
    isLocal: firm.isLocal,
    shop: shops.length
      ? {
          medianReplyMinutes: stats.medianRepliedMinutes,
          anyNoReply: shops.some((s) => !s.firstReplyAt),
          shopCount: shops.length,
        }
      : null,
    reviewFlags: firm.reviewFlagCount,
    fit: {
      status: (firm.fitStatus as "ok" | "excluded" | "not_a_fit") ?? "ok",
      reason: firm.fitReason,
    },
  };
}

export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}
