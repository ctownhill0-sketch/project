export type Software = "appfolio" | "buildium" | "doorloop" | "rent_manager" | "yardi" | "none" | "unknown";

export interface ScoringWeights {
  notAppfolio: number;
  noSoftware: number;
  listings3to25: number;
  slowReply: number;
  units50to500: number;
  local: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  notAppfolio: 30,
  noSoftware: 20,
  listings3to25: 20,
  slowReply: 25,
  units50to500: 15,
  local: 10,
};

export interface ShopFacts {
  /** Median minutes to first reply over replied shops; null when none replied. */
  medianReplyMinutes: number | null;
  /** At least one shop never got a reply. */
  anyNoReply: boolean;
  shopCount: number;
}

export interface LeadFacts {
  /** The effective software (override if set, else detected). */
  software: Software;
  units: number | null;
  liveListings: number | null;
  isLocal: boolean;
  shop: ShopFacts | null;
}

export type BreakdownLine = { rule: string; points: number; reason: string };

export interface ScoreResult {
  score: number;
  excluded: boolean;
  breakdown: BreakdownLine[];
}

const SLOW_REPLY_MINUTES = 120;

const SOFTWARE_LABEL: Record<Software, string> = {
  appfolio: "AppFolio",
  buildium: "Buildium",
  doorloop: "DoorLoop",
  rent_manager: "Rent Manager",
  yardi: "Yardi",
  none: "No portal found",
  unknown: "Software unknown",
};

export function softwareLabel(software: Software): string {
  return SOFTWARE_LABEL[software];
}

/** Lead score (brief M1): editable weights, capped 0–100, AppFolio excluded. */
export function scoreLead(facts: LeadFacts, weights: ScoringWeights): ScoreResult {
  if (facts.software === "appfolio") {
    return {
      score: 0,
      excluded: true,
      breakdown: [{ rule: "appfolio", points: 0, reason: "On AppFolio (excluded)" }],
    };
  }
  const lines: BreakdownLine[] = [
    { rule: "notAppfolio", points: weights.notAppfolio, reason: "Not on AppFolio" },
  ];
  if (facts.software === "none") {
    lines.push({ rule: "noSoftware", points: weights.noSoftware, reason: "No property software found" });
  }
  if (facts.liveListings !== null && facts.liveListings >= 3 && facts.liveListings <= 25) {
    lines.push({
      rule: "listings3to25",
      points: weights.listings3to25,
      reason: `${facts.liveListings} live listings`,
    });
  }
  const shop = facts.shop;
  if (
    shop &&
    (shop.anyNoReply || (shop.medianReplyMinutes !== null && shop.medianReplyMinutes > SLOW_REPLY_MINUTES))
  ) {
    lines.push({
      rule: "slowReply",
      points: weights.slowReply,
      reason: shop.anyNoReply
        ? "A mystery shop got no reply"
        : `Replied in ${formatMinutes(shop.medianReplyMinutes ?? 0)}`,
    });
  }
  if (facts.units !== null && facts.units >= 50 && facts.units <= 500) {
    lines.push({ rule: "units50to500", points: weights.units50to500, reason: `About ${facts.units} units` });
  }
  if (facts.isLocal) lines.push({ rule: "local", points: weights.local, reason: "In the target metro" });
  const total = lines.reduce((sum, l) => sum + l.points, 0);
  return { score: Math.min(100, Math.max(0, total)), excluded: false, breakdown: lines };
}

/** "4h 12m", "38m", "2d 3h". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`.replace(" 00m", "");
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/** One line on every row: only facts we have, never invented. */
export function whyThisLead(facts: LeadFacts): string {
  const parts: string[] = [softwareLabel(facts.software)];
  if (facts.units !== null) parts.push(`~${facts.units} units`);
  if (facts.liveListings !== null) parts.push(`${facts.liveListings} listings`);
  const shop = facts.shop;
  if (!shop || shop.shopCount === 0) parts.push("not shopped yet");
  else if (shop.anyNoReply) parts.push("no reply to shop");
  else if (shop.medianReplyMinutes !== null)
    parts.push(`first reply ${formatMinutes(shop.medianReplyMinutes)}`);
  return parts.join(", ");
}
