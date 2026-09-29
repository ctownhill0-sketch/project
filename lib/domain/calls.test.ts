import { describe, expect, it } from "vitest";
import {
  buildCallList,
  DISPOSITIONS,
  dispositionForKey,
  fillScript,
  suggestNextStep,
} from "@/lib/domain/calls";

describe("fillScript", () => {
  it("fills known variables and marks missing ones as unknown", () => {
    const r = fillScript(
      "Hi {{contactName}}, {{founderName}} here about {{firmName}}. Reply took {{replyTime}}.",
      {
        founderName: "Jordan",
        firmName: "Harborline",
        contactName: null,
        replyTime: "4h 12m",
      },
    );
    expect(r.text).toBe("Hi unknown, Jordan here about Harborline. Reply took 4h 12m.");
    expect(r.missing).toEqual(["contactName"]);
    expect(r.parts).toContainEqual({ text: "unknown", missing: true, variable: "contactName" });
  });

  it("treats variables it doesn't know as missing instead of leaving braces", () => {
    expect(fillScript("{{nope}}!", {}).text).toBe("unknown!");
  });
});

describe("dispositions", () => {
  it("maps hotkeys 1–9 in the schema's order", () => {
    expect(DISPOSITIONS.map((d) => d.key)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(dispositionForKey("5")?.value).toBe("conversation");
    expect(dispositionForKey("9")?.value).toBe("do_not_call");
    expect(dispositionForKey("0")).toBeNull();
  });

  it("suggests the next step in NY time", () => {
    const now = new Date("2026-09-29T14:00:00Z"); // Tue 10:00 NY
    expect(suggestNextStep("no_answer", now)!.toISOString()).toBe("2026-09-30T14:00:00.000Z"); // next day, same time
    expect(suggestNextStep("left_voicemail", now)!.toISOString()).toBe("2026-10-01T14:00:00.000Z"); // 2 days
    expect(suggestNextStep("conversation", now)!.toISOString()).toBe("2026-09-30T14:00:00.000Z");
    expect(suggestNextStep("not_interested", now)).toBeNull();
    expect(suggestNextStep("do_not_call", now)).toBeNull();
    // Friday → Monday (skip the weekend)
    expect(suggestNextStep("no_answer", new Date("2026-10-02T14:00:00Z"))!.toISOString()).toBe(
      "2026-10-05T14:00:00.000Z",
    );
  });
});

describe("buildCallList", () => {
  const now = new Date("2026-09-29T14:00:00Z");
  const firm = (id: string, extra: Partial<Parameters<typeof buildCallList>[0]["firms"][number]> = {}) => ({
    companyId: id,
    name: id,
    town: null,
    score: 50,
    why: "",
    phone: "(201) 555-0100",
    dnc: false,
    excluded: false,
    lastCalledAt: null,
    nextStepAt: null,
    callNow: false,
    lastDisposition: null,
    ...extra,
  });

  it("orders callbacks due, then call-now firms, then highest score; skips DNC, excluded and no-phone", () => {
    const list = buildCallList({
      now,
      firms: [
        firm("top", { score: 95 }),
        firm("mid", { score: 60 }),
        firm("hot", { score: 40, callNow: true }),
        firm("due", {
          score: 10,
          nextStepAt: new Date("2026-09-29T13:00:00Z"),
          lastCalledAt: new Date("2026-09-27T13:00:00Z"),
        }),
        firm("later", {
          score: 99,
          nextStepAt: new Date("2026-10-05T13:00:00Z"),
          lastCalledAt: new Date("2026-09-28T13:00:00Z"),
        }),
        firm("dnc", { score: 100, dnc: true }),
        firm("ex", { score: 100, excluded: true }),
        firm("nophone", { score: 100, phone: null }),
        firm("recent", { score: 90, lastCalledAt: new Date("2026-09-29T12:00:00Z") }),
        firm("no", {
          score: 97,
          lastCalledAt: new Date("2026-09-20T12:00:00Z"),
          lastDisposition: "not_interested",
        }),
        firm("wrong", {
          score: 97,
          lastCalledAt: new Date("2026-09-20T12:00:00Z"),
          lastDisposition: "wrong_number",
        }),
        firm("booked", {
          score: 97,
          lastCalledAt: new Date("2026-09-20T12:00:00Z"),
          lastDisposition: "audit_booked",
        }),
      ],
    });
    expect(list.map((i) => i.companyId)).toEqual(["due", "hot", "top", "mid"]);
    expect(list[0]!.reason).toMatch(/Callback/);
    expect(list[1]!.reason).toMatch(/Call now/);
  });
});
