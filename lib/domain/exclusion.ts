// Chain exclusion and "probably not a fit" rules (finder spec §6). Editable in Settings.

export interface ExclusionRuleInput {
  kind: "chain" | "not_a_fit";
  /** For not-a-fit: hoa | commercial | vacation | single_building | sales_only | other. */
  category: string | null;
  match: "name" | "domain" | "type";
  /** A phrase matched on word boundaries, or a /regex/ (case-insensitive). */
  pattern: string;
  isActive: boolean;
}

export interface FitResult {
  status: "ok" | "excluded" | "not_a_fit";
  category: string | null;
  reason: string | null;
  ruleId: string | null;
}

const CHAINS = [
  "Greystar",
  "Invitation Homes",
  "Progress Residential",
  "AvalonBay",
  "Avalon Communities",
  "Equity Residential",
  "Related Management",
  "Lincoln Property",
  "Bozzuto",
  "Cushman & Wakefield",
  "CBRE",
  "JLL",
  "Jones Lang LaSalle",
  "FirstService Residential",
  "Associa",
  "Roofstock",
  "Mynd",
  "Pathlight",
  "Real Property Management",
  "Keyrenter",
  "BH Management",
  "Camden Property",
  "Mid-America Apartment",
  "UDR",
  "Essex Property",
  "AMC Management",
  "Tricon Residential",
  "American Homes 4 Rent",
  "Asset Living",
  "RPM Living",
  "Morgan Properties",
  "Cortland",
  "Bell Partners",
];
const CHAIN_DOMAINS = [
  "greystar.com",
  "invitationhomes.com",
  "progressresidential.com",
  "avaloncommunities.com",
  "equityapartments.com",
];

const NOT_A_FIT: [category: string, match: ExclusionRuleInput["match"], pattern: string][] = [
  ["hoa", "name", "homeowners association"],
  ["hoa", "name", "home owners association"],
  ["hoa", "name", "HOA"],
  ["hoa", "name", "condominium association"],
  ["hoa", "name", "condo association"],
  ["hoa", "name", "community association management"],
  ["commercial", "name", "commercial real estate"],
  ["commercial", "name", "commercial properties"],
  ["commercial", "name", "office leasing"],
  ["commercial", "name", "industrial"],
  ["vacation", "name", "vacation rentals"],
  ["vacation", "name", "short-term rentals"],
  ["vacation", "name", "short term rentals"],
  ["vacation", "name", "airbnb"],
  ["vacation", "type", "lodging"],
  [
    "single_building",
    "name",
    "/^(the\\s+)?[a-z0-9' .-]+\\s+(apartments|apts|residences|towers?|lofts|flats)$/",
  ],
  ["sales_only", "name", "Keller Williams"],
  ["sales_only", "name", "RE/MAX"],
  ["sales_only", "name", "Coldwell Banker"],
  ["sales_only", "name", "Century 21"],
  ["sales_only", "name", "Sotheby's"],
  ["sales_only", "name", "Berkshire Hathaway HomeServices"],
  ["sales_only", "name", "eXp Realty"],
];

export const DEFAULT_EXCLUSION_RULES: ExclusionRuleInput[] = [
  ...CHAINS.map((pattern) => ({
    kind: "chain" as const,
    category: null,
    match: "name" as const,
    pattern,
    isActive: true,
  })),
  ...CHAIN_DOMAINS.map((pattern) => ({
    kind: "chain" as const,
    category: null,
    match: "domain" as const,
    pattern,
    isActive: true,
  })),
  ...NOT_A_FIT.map(([category, match, pattern]) => ({
    kind: "not_a_fit" as const,
    category,
    match,
    pattern,
    isActive: true,
  })),
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

function toRegex(pattern: string): RegExp | null {
  try {
    const m = /^\/(.+)\/$/.exec(pattern.trim());
    if (m) return new RegExp(m[1]!, "i");
    // Word-boundary phrase match; non-word edges (e.g. "RE/MAX") still need a separator.
    return new RegExp(`(^|[^a-z0-9])${escape(pattern.trim())}($|[^a-z0-9])`, "i");
  } catch {
    return null;
  }
}

function matches(
  rule: ExclusionRuleInput,
  place: { name: string; domain: string | null; types: string[] },
): boolean {
  if (rule.match === "domain") {
    const d = place.domain?.toLowerCase();
    const p = rule.pattern.toLowerCase().trim();
    return Boolean(d && (d === p || d.endsWith(`.${p}`)));
  }
  if (rule.match === "type") return place.types.includes(rule.pattern.trim());
  const re = toRegex(rule.pattern);
  return re ? re.test(place.name.trim()) : false;
}

const CATEGORY_LABEL: Record<string, string> = {
  hoa: "HOA or condo association only",
  commercial: "Commercial only",
  vacation: "Vacation or short-term rentals",
  single_building: "Single building",
  sales_only: "Sales brokerage",
};

export function classifyFit(
  place: { name: string; domain: string | null; types: string[] },
  rules: (ExclusionRuleInput & { id: string })[],
): FitResult {
  const active = rules.filter((r) => r.isActive);
  const chain = active.find((r) => r.kind === "chain" && matches(r, place));
  if (chain)
    return {
      status: "excluded",
      category: "chain",
      reason: `Chain or large operator: ${chain.pattern}`,
      ruleId: chain.id,
    };
  const misfit = active.find((r) => r.kind === "not_a_fit" && matches(r, place));
  if (misfit) {
    const label = CATEGORY_LABEL[misfit.category ?? ""] ?? "Probably not a fit";
    return {
      status: "not_a_fit",
      category: misfit.category,
      reason: `Probably not a fit: ${label}`,
      ruleId: misfit.id,
    };
  }
  return { status: "ok", category: null, reason: null, ruleId: null };
}
