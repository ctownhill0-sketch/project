import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderAuditPdf, winAnsiSafe } from "@/lib/audits/pdf";
import { buildSnapshot } from "@/lib/domain/audit";
import { DEFAULT_ROI_INPUTS } from "@/lib/domain/roi";

const NOW = new Date("2026-09-29T15:00:00Z");
const SENT = new Date("2026-09-15T01:30:00Z");

function snapshot(shopCount: number) {
  return buildSnapshot({
    firm: { name: "Harborline Residential", metro: "New York metro" },
    firmShops: Array.from({ length: shopCount }, (_, i) => ({
      sentAt: new Date(SENT.getTime() + i * 86_400_000),
      firstReplyAt: i % 2 ? null : new Date(SENT.getTime() + i * 86_400_000 + 843 * 60_000),
      hoursBucket: "after_hours",
      channel: "email",
      replyType: i % 2 ? "none" : "human",
      tourOffered: i % 2 ? null : true,
    })),
    metroShops: [],
    roi: { inputs: DEFAULT_ROI_INPUTS, source: "default" },
    now: NOW,
  });
}

describe("winAnsiSafe", () => {
  it("keeps what the standard fonts can draw and replaces the rest", () => {
    expect(winAnsiSafe("Café “quotes” – 3× · $59.18")).toBe("Café “quotes” – 3× · $59.18");
    expect(winAnsiSafe("a → b ≥ c 🏠 日本")).toBe("a -> b >= c ? ??");
  });
});

describe("renderAuditPdf", () => {
  it("renders exactly one page, even with many shops and odd characters", async () => {
    const bytes = await renderAuditPdf({
      brand: "Vacancy Desk",
      snapshot: snapshot(20),
      summary: "Your median reply took 14 hours → too slow 🏠. Renters move on. Let's fix it.",
      exportedAt: NOW,
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Vacancy audit: Harborline Residential");
  });
});
