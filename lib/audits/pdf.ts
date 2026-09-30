// One-page vacancy audit PDF (brief M8), drawn with pdf-lib from the same sections the preview uses.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { auditSections, type AuditSnapshot } from "@/lib/domain/audit";

const PAGE: [number, number] = [612, 792]; // US Letter, points
const MARGIN = 48;
const WIDTH = PAGE[0] - MARGIN * 2;
const MAX_SHOP_LINES = 8;

// Graphite tokens (lib/design/tokens.ts): fg, muted text, primary, border, card surface.
const FG = rgb(0x17 / 255, 0x17 / 255, 0x1c / 255);
const MUTED = rgb(0x50 / 255, 0x50 / 255, 0x5c / 255);
const PRIMARY = rgb(0x43 / 255, 0x38 / 255, 0xca / 255);
const BORDER = rgb(0xd9 / 255, 0xd9 / 255, 0xde / 255);
const SURFACE = rgb(0xf6 / 255, 0xf6 / 255, 0xf7 / 255);

// The standard PDF fonts only cover WinAnsi. Everything else becomes a plain equivalent or "?".
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const REPLACE: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "≈": "~",
  "≤": "<=",
  "≥": ">=",
  "−": "-",
  " ": " ",
};

export function winAnsiSafe(text: string): string {
  return Array.from(text.normalize("NFC"))
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (ch === "\n") return ch;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) return ch;
      return REPLACE[ch] ?? "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsiSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export interface PdfInput {
  brand: string;
  snapshot: AuditSnapshot;
  summary: string;
  exportedAt: Date;
}

export async function renderAuditPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsiSafe(`Vacancy audit: ${input.snapshot.firmName}`));
  doc.setAuthor(winAnsiSafe(input.brand));
  doc.setCreator(winAnsiSafe(input.brand));
  doc.setProducer(winAnsiSafe(input.brand));
  doc.setCreationDate(input.exportedAt);
  doc.setModificationDate(input.exportedAt);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const text = (t: string, x: number, size: number, font = regular, color = FG) =>
    page.drawText(winAnsiSafe(t), { x, y, size, font, color });
  const para = (t: string, size = 10, font = regular, color = FG, x = MARGIN, width = WIDTH) => {
    for (const line of wrap(t, font, size, width)) {
      y -= size * 1.4;
      page.drawText(line, { x, y, size, font, color });
    }
  };

  // Header: wordmark and date, then the title.
  y -= 12;
  text(input.brand, MARGIN, 12, bold, PRIMARY);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(input.exportedAt);
  page.drawText(date, {
    x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(date, 10),
    y,
    size: 10,
    font: regular,
    color: MUTED,
  });
  y -= 30;
  text(`Vacancy audit: ${input.snapshot.firmName}`, MARGIN, 20, bold);

  // Summary box.
  const lines = wrap(input.summary, regular, 11, WIDTH - 24);
  const boxHeight = lines.length * 15.4 + 28;
  y -= 14;
  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: WIDTH,
    height: boxHeight,
    color: SURFACE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  y -= 16;
  text("Summary", MARGIN + 12, 9, bold, MUTED);
  y -= 2;
  for (const line of lines) {
    y -= 15.4;
    page.drawText(line, { x: MARGIN + 12, y, size: 11, font: regular, color: FG });
  }
  y -= 20;

  for (const section of auditSections(input.snapshot)) {
    y -= 18;
    text(section.title, MARGIN, 13, bold);
    y -= 4;
    if (section.rows?.length) {
      const hasMetro = section.rows.some((r) => r.metro !== undefined);
      const colFirm = MARGIN + (hasMetro ? 290 : 330);
      const colMetro = MARGIN + 410;
      if (hasMetro) {
        y -= 14;
        text("This firm", colFirm, 9, bold, MUTED);
        text("Metro median", colMetro, 9, bold, MUTED);
      }
      for (const row of section.rows) {
        y -= 14;
        page.drawLine({
          start: { x: MARGIN, y: y + 11 },
          end: { x: MARGIN + WIDTH, y: y + 11 },
          color: BORDER,
          thickness: 0.5,
        });
        text(row.label, MARGIN, 10, regular, MUTED);
        text(row.firm, colFirm, 10, bold);
        if (row.metro !== undefined) text(row.metro, colMetro, 10);
      }
    }
    const shown =
      section.title === "What a renter experienced" && (section.lines?.length ?? 0) > MAX_SHOP_LINES
        ? [...section.lines!.slice(0, MAX_SHOP_LINES), `And ${section.lines!.length - MAX_SHOP_LINES} more.`]
        : (section.lines ?? []);
    const small = section.title === "Method";
    for (const line of shown) para(line, small ? 9 : 10, regular, small ? MUTED : FG);
  }

  // Footer.
  y = MARGIN - 12;
  para(
    "Response behavior only; rents are never compared across firms. Wording checked for fair-housing issues (screening aid, not legal advice).",
    8,
    regular,
    MUTED,
  );

  return doc.save({ useObjectStreams: false });
}
