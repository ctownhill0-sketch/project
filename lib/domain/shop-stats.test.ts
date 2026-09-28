import { describe, expect, it } from "vitest";
import { shopStats, type ShopTiming } from "@/lib/domain/shop-stats";

const NOW = new Date("2026-09-28T16:00:00Z");
const at = (iso: string) => new Date(iso);
const shop = (sent: string, replyMinutes: number | null): ShopTiming => ({
  sentAt: at(sent),
  firstReplyAt: replyMinutes === null ? null : new Date(at(sent).getTime() + replyMinutes * 60_000),
});

describe("shopStats", () => {
  it("reports both medians so no-replies are never silently dropped", () => {
    // replies at 10, 30, 90 minutes; two shops never answered
    const shops = [
      shop("2026-09-20T12:00:00Z", 10),
      shop("2026-09-21T12:00:00Z", 30),
      shop("2026-09-22T12:00:00Z", 90),
      shop("2026-09-23T12:00:00Z", null),
      shop("2026-09-24T12:00:00Z", null),
    ];
    const s = shopStats(shops, NOW);
    expect(s.count).toBe(5);
    expect(s.medianRepliedMinutes).toBe(30);
    // with no-replies as "never": sorted [10, 30, 90, ∞, ∞] -> median 90
    expect(s.medianWithNoReplyMinutes).toBe(90);
    expect(s.noReplyShare24h).toBeCloseTo(0.4);
  });

  it("returns Infinity when most shops never got a reply", () => {
    const s = shopStats(
      [
        shop("2026-09-20T12:00:00Z", 10),
        shop("2026-09-21T12:00:00Z", null),
        shop("2026-09-22T12:00:00Z", null),
      ],
      NOW,
    );
    expect(s.medianWithNoReplyMinutes).toBe(Number.POSITIVE_INFINITY);
    expect(s.medianRepliedMinutes).toBe(10);
  });

  it("computes P75 and P90 over replied shops", () => {
    const shops = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((m, i) =>
      shop(`2026-09-${String(10 + i).padStart(2, "0")}T12:00:00Z`, m),
    );
    const s = shopStats(shops, NOW);
    expect(s.medianRepliedMinutes).toBe(55);
    expect(s.p75RepliedMinutes).toBe(77.5);
    expect(s.p90RepliedMinutes).toBe(91);
  });

  it("only counts a shop as unanswered after the window has passed", () => {
    // sent 2h ago with no reply yet: too early to judge, so it's left out of the 24h share
    const s = shopStats([shop("2026-09-28T14:00:00Z", null), shop("2026-09-20T12:00:00Z", null)], NOW);
    expect(s.noReplyShare24h).toBe(1);
    expect(s.count).toBe(2);
    // a reply that came after 30h counts as "no reply within 24h" but not within 72h
    const late = shopStats([shop("2026-09-20T12:00:00Z", 30 * 60)], NOW);
    expect(late.noReplyShare24h).toBe(1);
    expect(late.noReplyShare72h).toBe(0);
  });

  it("handles no shops without inventing numbers", () => {
    const s = shopStats([], NOW);
    expect(s).toMatchObject({
      count: 0,
      medianRepliedMinutes: null,
      medianWithNoReplyMinutes: null,
      noReplyShare24h: null,
    });
  });
});
