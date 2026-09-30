// Vacancy audit (brief M8): a one-page summary of a firm's mystery-shop results vs the metro,
// the renter's experience, the ROI estimate and a method note. Pure: no I/O.
// The founder writes the 3-sentence summary. AI-HOOK(M8): a drafted summary would plug in here and
// still pass the same number-grounding and fair-housing checks.
import { formatMinutes } from "@/lib/domain/scoring";
import { roi, type RoiInputs } from "@/lib/domain/roi";
import { shopStats } from "@/lib/domain/shop-stats";

/** A metro comparison needs shops from at least this many firms, so no single firm can be inferred. */
export const MIN_METRO_FIRMS = 3;
export const SUMMARY_SENTENCES = 3;

/** Minutes as JSON can hold them: "never" is a shop that got no reply. */
export type Minutes = number | "never" | null;

export interface AuditShop {
  sentAt: string;
  hoursBucket: string;
  channel: string;
  replyMinutes: number | null;
  replyType: string;
  tourOffered: boolean | null;
}

export interface AuditStats {
  count: number;
  replied: number;
  medianWithNoReplyMinutes: Minutes;
  medianRepliedMinutes: Minutes;
  noReplyShare24h: number | null;
}

export interface AuditSnapshot {
  firmName: string;
  metroName: string | null;
  generatedAt: string;
  shops: AuditShop[];
  firm: AuditStats;
  metro: (AuditStats & { firms: number; shops: number }) | null;
  roi: { inputs: RoiInputs; results: ReturnType<typeof roi>; source: "saved" | "default" };
}

interface ShopInput {
  sentAt: Date;
  firstReplyAt: Date | null;
  hoursBucket: string;
  channel: string;
  replyType: string;
  tourOffered: boolean | null;
}

const toMinutes = (v: number | null): Minutes =>
  v === null ? null : Number.isFinite(v) ? Math.round(v) : "never";

function stats(shops: { sentAt: Date; firstReplyAt: Date | null }[], now: Date): AuditStats {
  const s = shopStats(shops, now);
  return {
    count: s.count,
    replied: s.replied,
    medianWithNoReplyMinutes: toMinutes(s.medianWithNoReplyMinutes),
    medianRepliedMinutes: toMinutes(s.medianRepliedMinutes),
    noReplyShare24h: s.noReplyShare24h,
  };
}

export function buildSnapshot(input: {
  firm: { name: string; metro: string | null };
  firmShops: ShopInput[];
  metroShops: { companyId: string; sentAt: Date; firstReplyAt: Date | null }[];
  roi: { inputs: RoiInputs; source: "saved" | "default" };
  now: Date;
}): AuditSnapshot {
  const firms = new Set(input.metroShops.map((s) => s.companyId)).size;
  const shops = [...input.firmShops].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  return {
    firmName: input.firm.name,
    metroName: input.firm.metro,
    generatedAt: input.now.toISOString(),
    shops: shops.map((s) => ({
      sentAt: s.sentAt.toISOString(),
      hoursBucket: s.hoursBucket,
      channel: s.channel,
      replyMinutes: s.firstReplyAt
        ? Math.round((s.firstReplyAt.getTime() - s.sentAt.getTime()) / 60_000)
        : null,
      replyType: s.replyType,
      tourOffered: s.tourOffered,
    })),
    firm: stats(shops, input.now),
    // Aggregates only: no firm ids or names leave this function.
    metro:
      firms >= MIN_METRO_FIRMS
        ? { ...stats(input.metroShops, input.now), firms, shops: input.metroShops.length }
        : null,
    roi: { ...input.roi, results: roi(input.roi.inputs) },
  };
}

// ---------------------------------------------------------------------------------------------
// What the page shows. The PDF, the preview, the fair-housing check and the number check all
// read this one structure, so they can't drift apart.

export const describeMinutes = (m: Minutes) =>
  m === null ? "unknown" : m === "never" ? "Never (no reply)" : formatMinutes(m);
const percent = (x: number | null) => (x === null ? "unknown" : `${Math.round(x * 100)}%`);
const money = (n: number, cents = false) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
const nyDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(iso));
const nyDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(iso));

const BUCKET: Record<string, string> = {
  business: "business hours",
  saturday: "Saturday",
  after_hours: "after hours",
};
const CHANNEL: Record<string, string> = {
  email: "email",
  phone: "phone",
  listing_site: "a listing site",
  website_form: "their website form",
};
const REPLY: Record<string, string> = { human: "a person", auto: "an auto-reply", ai: "an AI assistant" };

export interface AuditRow {
  label: string;
  firm: string;
  metro?: string;
}
export interface AuditSection {
  title: string;
  rows?: AuditRow[];
  lines?: string[];
}

export function auditSections(s: AuditSnapshot): AuditSection[] {
  const m = s.metro;
  const ratio =
    typeof s.firm.medianWithNoReplyMinutes === "number" &&
    typeof m?.medianWithNoReplyMinutes === "number" &&
    m.medianWithNoReplyMinutes > 0
      ? s.firm.medianWithNoReplyMinutes / m.medianWithNoReplyMinutes
      : null;
  const r = s.roi;
  const first = s.shops[0]?.sentAt;
  const last = s.shops.at(-1)?.sentAt;
  return [
    {
      title: "Response time",
      rows: [
        {
          label: "Median first reply, no reply counted as never",
          firm: describeMinutes(s.firm.medianWithNoReplyMinutes),
          metro: m ? describeMinutes(m.medianWithNoReplyMinutes) : "unknown",
        },
        {
          label: "Median first reply, replies only",
          firm: describeMinutes(s.firm.medianRepliedMinutes),
          metro: m ? describeMinutes(m.medianRepliedMinutes) : "unknown",
        },
        {
          label: "No reply within 24h",
          firm: percent(s.firm.noReplyShare24h),
          metro: m ? percent(m.noReplyShare24h) : "unknown",
        },
        {
          label: "Inquiries sent",
          firm: `${s.firm.count} (${s.firm.replied} of ${s.firm.count} got a reply)`,
          metro: m ? `${m.shops} across ${m.firms} firms` : "unknown",
        },
      ],
      lines: [
        m
          ? ratio !== null
            ? `Your median is ${ratio.toFixed(1)}× the ${s.metroName ?? "metro"} median.`
            : `Compared with the ${s.metroName ?? "metro"} median, without naming any firm.`
          : "Not enough shops in this metro yet for a fair comparison. Metro figures show as unknown.",
      ],
    },
    {
      title: "What a renter experienced",
      lines: s.shops.length
        ? s.shops.map((sh) => {
            const reply =
              sh.replyMinutes === null
                ? "no reply"
                : `first reply after ${formatMinutes(sh.replyMinutes)}, from ${REPLY[sh.replyType] ?? "unknown"}`;
            const tour =
              sh.tourOffered === true
                ? "; a tour was offered"
                : sh.tourOffered === false
                  ? "; no tour offered"
                  : "";
            return `${nyDateTime(sh.sentAt)} (${BUCKET[sh.hoursBucket] ?? sh.hoursBucket}), via ${CHANNEL[sh.channel] ?? sh.channel}: ${reply}${tour}.`;
          })
        : ["No inquiries logged yet."],
    },
    {
      title: "What slow replies cost (Estimated)",
      rows: [
        { label: "Typical monthly rent", firm: money(r.inputs.rent) },
        { label: "Each vacant day costs", firm: money(r.results.dailyCost, true) },
        {
          label: `Turnovers a year × days vacant`,
          firm: `${r.inputs.turnoversPerYear} × ${r.inputs.daysVacant} days`,
        },
        { label: "Lost to vacancy a year", firm: money(r.results.annualVacancyLoss) },
        {
          label: `Saved a year by leasing ${r.inputs.daysFaster} days faster`,
          firm: money(r.results.annualSavings),
        },
      ],
      lines: [
        r.source === "saved"
          ? "Estimated from the inputs agreed on the call."
          : "Estimated from typical inputs. Your real numbers will differ.",
      ],
    },
    {
      title: "Method",
      lines: [
        `${s.firm.count} genuine rental ${s.firm.count === 1 ? "inquiry was" : "inquiries were"} sent to ${s.firmName}${first && last ? ` between ${nyDate(first)} and ${nyDate(last)}` : ""}, under the sender's real name, across business hours, Saturdays and after hours (New York time). No tours were booked.`,
        "Response time runs from sending to the first reply of any kind. An inquiry with no reply counts as never answered, not as missing.",
        "The metro median uses the same method across several firms and names none of them. It covers response behavior only; rents are never compared across firms.",
      ],
    },
  ];
}

/** The page's full text, in reading order: what the fair-housing check and the hash cover. */
export function auditText(s: AuditSnapshot, summary: string): string {
  const parts = [`Vacancy audit: ${s.firmName}`, summary.trim()];
  for (const sec of auditSections(s)) {
    parts.push(sec.title);
    for (const row of sec.rows ?? [])
      parts.push(`${row.label}: ${row.firm}${row.metro ? ` | Metro: ${row.metro}` : ""}`);
    parts.push(...(sec.lines ?? []));
  }
  return parts.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------------------------
// Summary checks

export function countSentences(text: string): number {
  return text
    .trim()
    .split(/[.!?]+(?=\s|$)/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
}

const NUMBER = /\$?\d[\d,]*(?:\.\d+)?%?/g;
const value = (token: string) => Number(token.replace(/[$,%]/g, ""));

/**
 * Numbers in the summary that don't appear on the page. A whole number may round or truncate a
 * figure shown ("$59" for $59.18, "14 hours" for 14h 03m); a decimal must match to its precision.
 */
export function ungroundedNumbers(summary: string, s: AuditSnapshot): string[] {
  const shown = (auditText(s, "").match(NUMBER) ?? []).map(value);
  return (summary.match(NUMBER) ?? []).filter((token) => {
    const v = value(token);
    const decimals = token.replace(/%$/, "").split(".")[1]?.length ?? 0;
    return !shown.some((a) =>
      decimals === 0 ? v === Math.round(a) || v === Math.trunc(a) : v === Number(a.toFixed(decimals)),
    );
  });
}

/** Everything that stops export, in plain words. Empty means the summary is ready. */
export function exportProblems(summary: string, s: AuditSnapshot): string[] {
  const n = countSentences(summary);
  if (n === 0) return ["Write the three-sentence summary."];
  const problems: string[] = [];
  if (n !== SUMMARY_SENTENCES)
    problems.push(
      `The summary has ${n} ${n === 1 ? "sentence" : "sentences"}. Use exactly ${SUMMARY_SENTENCES}.`,
    );
  const loose = ungroundedNumbers(summary, s);
  if (loose.length)
    problems.push(
      `These numbers aren't in the audit's data: ${loose.join(", ")}. Use the figures shown, or remove them.`,
    );
  return problems;
}
