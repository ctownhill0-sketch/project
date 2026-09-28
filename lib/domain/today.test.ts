import { describe, expect, it } from "vitest";
import { buildToday, type TodayInputs } from "@/lib/domain/today";

const NOW = new Date("2026-09-28T16:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
const firm = (id: string, score: number) => ({
  companyId: id,
  name: `Firm ${id}`,
  town: "Brooklyn",
  score,
  why: "Buildium",
});

const inputs: TodayInputs = {
  now: NOW,
  dueBy: h(8), // end of the working day
  callbacks: [
    { ...firm("b", 60), dueAt: h(2) },
    { ...firm("a", 50), dueAt: h(-20) }, // overdue
    { ...firm("z", 99), dueAt: h(48) }, // not due yet
  ],
  openShops: [
    { ...firm("c", 70), sentAt: h(-5) }, // 5h ago, no reply: 4h check passed
    { ...firm("d", 70), sentAt: h(-0.5) }, // too recent for the 1h check
    { ...firm("e", 70), sentAt: h(-24 * 10) }, // older than 7 days: dropped
  ],
  candidates: [firm("x", 95), firm("a", 90), firm("y", 80)],
};

describe("buildToday", () => {
  it("orders callbacks (overdue first), then reply checks, then top scores", () => {
    const t = buildToday(inputs, 10);
    expect(t.items.map((i) => `${i.kind}:${i.companyId}`)).toEqual([
      "callback:a",
      "callback:b",
      "reply_check:c",
      "top_score:x",
      "top_score:y",
    ]);
  });

  it("shows each firm once and says why it's there", () => {
    const t = buildToday(inputs, 10);
    expect(t.items.filter((i) => i.companyId === "a")).toHaveLength(1);
    expect(t.items[0]?.reason).toMatch(/overdue/i);
    expect(t.items.find((i) => i.kind === "reply_check")?.reason).toMatch(/4h reply check/);
  });

  it("picks the first callable item as Next up (never a reply check)", () => {
    expect(buildToday(inputs, 10).nextUp?.companyId).toBe("a");
    const onlyChecks = buildToday({ ...inputs, callbacks: [], candidates: [] }, 10);
    expect(onlyChecks.nextUp).toBeNull();
  });

  it("respects the limit and reports the total due", () => {
    const t = buildToday(inputs, 2);
    expect(t.items).toHaveLength(2);
    expect(t.totalDue).toBe(5);
  });
});

describe("buildToday without de-duplication (notification bell)", () => {
  it("keeps every reminder even when two belong to the same firm", () => {
    const t = buildToday(
      { ...inputs, openShops: [{ ...firm("a", 50), sentAt: h(-5) }], candidates: [] },
      10,
      { dedupe: false },
    );
    expect(t.items.filter((i) => i.companyId === "a").map((i) => i.kind)).toEqual([
      "callback",
      "reply_check",
    ]);
  });
});
