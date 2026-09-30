import { describe, expect, it } from "vitest";
import { firstRunChecklist, type FirstRunFacts } from "@/lib/domain/first-run";

const fresh: FirstRunFacts = {
  shopperNameSet: false,
  placesKeySet: false,
  demoFirmsLeft: 50,
  realLeads: 0,
  realShops: 0,
  realCalls: 0,
  thisWeekEntered: false,
};

describe("firstRunChecklist", () => {
  it("starts with nothing done, each step linking to where it's done", () => {
    const c = firstRunChecklist(fresh);
    expect(c.done).toBe(0);
    expect(c.total).toBe(7);
    expect(c.complete).toBe(false);
    expect(c.items.map((i) => i.href)).toEqual([
      "/settings#brand",
      "/settings#places",
      "/settings#data",
      "/finder",
      "/shops/plan",
      "/calls?mode=block",
      "/settings#weekly",
    ]);
    expect(c.next?.label).toBe("Set your real name for mystery shops");
  });

  it("counts progress and is complete when every step is done", () => {
    const c = firstRunChecklist({ ...fresh, shopperNameSet: true, demoFirmsLeft: 0, realLeads: 24 });
    expect(c.done).toBe(2);
    expect(c.items.find((i) => i.key === "leads")).toMatchObject({ done: false, progress: "24 of 25" });
    const all = firstRunChecklist({
      shopperNameSet: true,
      placesKeySet: true,
      demoFirmsLeft: 0,
      realLeads: 25,
      realShops: 5,
      realCalls: 1,
      thisWeekEntered: true,
    });
    expect(all).toMatchObject({ done: 7, complete: true, next: null });
  });
});
