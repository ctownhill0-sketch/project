import { describe, expect, it } from "vitest";
import {
  auditSections,
  auditText,
  buildSnapshot,
  countSentences,
  exportProblems,
  MIN_METRO_FIRMS,
  ungroundedNumbers,
} from "@/lib/domain/audit";
import { DEFAULT_ROI_INPUTS } from "@/lib/domain/roi";

const NOW = new Date("2026-09-29T15:00:00Z");
const at = (iso: string) => new Date(iso);
const mins = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

const S1 = at("2026-09-15T01:30:00Z"); // Mon 21:30 NY
const S2 = at("2026-09-19T14:00:00Z"); // Sat 10:00 NY
const firmShops = [
  {
    sentAt: S1,
    firstReplyAt: mins(S1, 843),
    hoursBucket: "after_hours",
    channel: "email",
    replyType: "human",
    tourOffered: true,
  },
  {
    sentAt: S2,
    firstReplyAt: null,
    hoursBucket: "saturday",
    channel: "listing_site",
    replyType: "none",
    tourOffered: null,
  },
] as const;
const metroShops = [
  { companyId: "a", sentAt: S1, firstReplyAt: mins(S1, 30) },
  { companyId: "b", sentAt: S1, firstReplyAt: mins(S1, 45) },
  { companyId: "c", sentAt: S1, firstReplyAt: mins(S1, 60) },
];

function snapshot(metro = metroShops) {
  return buildSnapshot({
    firm: { name: "Harborline Residential", metro: "New York metro" },
    firmShops: [...firmShops],
    metroShops: metro,
    roi: { inputs: DEFAULT_ROI_INPUTS, source: "default" },
    now: NOW,
  });
}

describe("countSentences", () => {
  it("counts sentences, ignoring decimals", () => {
    expect(countSentences("")).toBe(0);
    expect(countSentences("  ")).toBe(0);
    expect(countSentences("One. Two! Three?")).toBe(3);
    expect(countSentences("It costs $59.18 a day. Next step")).toBe(2);
  });
});

describe("buildSnapshot", () => {
  it("freezes this firm's shops and stats; no reply counts as never", () => {
    const s = snapshot();
    expect(s.firmName).toBe("Harborline Residential");
    expect(s.shops).toHaveLength(2);
    expect(s.shops[0]).toMatchObject({ replyMinutes: 843, hoursBucket: "after_hours" });
    expect(s.shops[1]!.replyMinutes).toBeNull();
    expect(s.firm.medianWithNoReplyMinutes).toBe("never");
    expect(s.firm.medianRepliedMinutes).toBe(843);
    expect(s.roi.results.dailyCost).toBe(59.18);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("gives a metro median only with enough firms, and never names them", () => {
    const s = snapshot();
    expect(s.metro).toMatchObject({ firms: 3, shops: 3, medianWithNoReplyMinutes: 45 });
    expect(JSON.stringify(s.metro)).not.toMatch(/"a"|"b"|"c"/);
    expect(snapshot(metroShops.slice(0, MIN_METRO_FIRMS - 1)).metro).toBeNull();
  });
});

describe("auditSections and auditText", () => {
  it("shows the comparison, the renter's experience, ROI as an estimate, and the method", () => {
    const s = snapshot();
    const text = auditText(s, "My summary.");
    expect(text).toContain("Harborline Residential");
    expect(text).toContain("My summary.");
    expect(text).toContain("14h 03m");
    expect(text).toContain("Never (no reply)");
    expect(text).toContain("45m");
    expect(text).toContain("$59.18");
    expect(text).toContain("Estimated");
    expect(text).toMatch(/Method/);
    expect(text).toMatch(/response behavior only/i);
    const sections = auditSections(s);
    expect(sections.map((x) => x.title)).toEqual([
      "Response time",
      "What a renter experienced",
      "What slow replies cost (Estimated)",
      "Method",
    ]);
  });

  it("says so when the metro comparison isn't possible yet", () => {
    expect(auditText(snapshot([]), "")).toContain("Not enough shops in this metro yet");
  });
});

describe("ungroundedNumbers", () => {
  it("accepts numbers shown in the audit, including rounded ones", () => {
    const s = snapshot();
    expect(
      ungroundedNumbers(
        "Your median reply took 14 hours, versus 45m across the metro. Half your shops got no reply within 24h, and 1 never did. Each vacant day costs about $59.",
        s,
      ),
    ).toEqual([]);
  });

  it("flags numbers that aren't in the audit's data", () => {
    const s = snapshot();
    expect(ungroundedNumbers("You replied in 12 hours and lose $4,000 a month.", s)).toEqual([
      "12",
      "$4,000",
    ]);
  });
});

describe("exportProblems", () => {
  it("needs exactly three sentences and only grounded numbers", () => {
    const s = snapshot();
    expect(exportProblems("", s)).toEqual(["Write the three-sentence summary."]);
    expect(exportProblems("One. Two.", s)).toEqual(["The summary has 2 sentences. Use exactly 3."]);
    expect(exportProblems("You took 12 hours. Renters move on. Let's fix it.", s)).toEqual([
      "These numbers aren't in the audit's data: 12. Use the figures shown, or remove them.",
    ]);
    expect(exportProblems("You took 14 hours. Renters move on. Let's fix it.", s)).toEqual([]);
  });
});
