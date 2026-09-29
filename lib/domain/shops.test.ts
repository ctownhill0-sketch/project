import { describe, expect, it } from "vitest";
import { nextAllowedShopAt, replyTimeProblem, statsByBucket, SHOP_COOLDOWN_DAYS } from "@/lib/domain/shops";

const at = (s: string) => new Date(s);

describe("one shop per firm per 30 days (ethics rule)", () => {
  it("allows a firm never shopped", () => {
    expect(nextAllowedShopAt(null)).toBeNull();
  });

  it("blocks until 30 days after the last shop", () => {
    expect(SHOP_COOLDOWN_DAYS).toBe(30);
    expect(nextAllowedShopAt(at("2026-09-01T15:00:00Z"))!.toISOString()).toBe("2026-10-01T15:00:00.000Z");
  });
});

describe("replyTimeProblem", () => {
  const sent = at("2026-09-29T14:00:00Z");
  const now = at("2026-09-29T20:00:00Z");
  it("accepts a reply between sending and now", () => {
    expect(replyTimeProblem(sent, at("2026-09-29T15:00:00Z"), now)).toBeNull();
  });
  it("rejects a reply before the inquiry or in the future", () => {
    expect(replyTimeProblem(sent, at("2026-09-29T13:59:00Z"), now)).toMatch(/before/);
    expect(replyTimeProblem(sent, at("2026-09-29T21:00:00Z"), now)).toMatch(/future/);
  });
});

describe("statsByBucket", () => {
  it("splits business, Saturday and after-hours, counting no-replies", () => {
    const now = at("2026-10-10T00:00:00Z");
    const s = statsByBucket(
      [
        {
          sentAt: at("2026-09-29T14:00:00Z"),
          firstReplyAt: at("2026-09-29T15:00:00Z"),
          hoursBucket: "business",
        },
        {
          sentAt: at("2026-09-29T14:00:00Z"),
          firstReplyAt: at("2026-09-29T14:30:00Z"),
          hoursBucket: "business",
        },
        { sentAt: at("2026-10-03T14:00:00Z"), firstReplyAt: null, hoursBucket: "saturday" },
        {
          sentAt: at("2026-09-30T01:00:00Z"),
          firstReplyAt: at("2026-09-30T13:00:00Z"),
          hoursBucket: "after_hours",
        },
      ],
      now,
    );
    expect(s.business.medianRepliedMinutes).toBe(45);
    expect(s.saturday).toMatchObject({
      count: 1,
      replied: 0,
      medianWithNoReplyMinutes: Number.POSITIVE_INFINITY,
    });
    expect(s.after_hours.medianRepliedMinutes).toBe(720);
    expect(s.all.count).toBe(4);
  });
});
