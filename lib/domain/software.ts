import type { Software } from "@/lib/domain/scoring";

export interface SoftwarePatternInput {
  software: Software;
  /** A host (kind "domain": matches the host or any subdomain) or a URL substring. */
  pattern: string;
  kind: "domain" | "substring";
}

/** Seeded into `software_pattern` and editable in Settings (finder spec §5). */
export const DEFAULT_SOFTWARE_PATTERNS: SoftwarePatternInput[] = [
  { software: "appfolio", pattern: "appfolio.com", kind: "domain" },
  { software: "buildium", pattern: "managebuilding.com", kind: "domain" },
  { software: "buildium", pattern: "buildium.com", kind: "domain" },
  { software: "doorloop", pattern: "doorloop.com", kind: "domain" },
  { software: "rent_manager", pattern: "rentmanager", kind: "substring" },
  { software: "rent_manager", pattern: "rmresident", kind: "substring" },
  { software: "yardi", pattern: "rentcafe", kind: "substring" },
  { software: "yardi", pattern: "securecafe", kind: "substring" },
  { software: "yardi", pattern: "yardibreeze", kind: "substring" },
  { software: "propertyware", pattern: "propertyware.com", kind: "domain" },
  { software: "rentvine", pattern: "rentvine.com", kind: "domain" },
  { software: "tenantcloud", pattern: "tenantcloud.com", kind: "domain" },
];

/** Vendor names as they appear in page text ("Powered by …"). */
export const SOFTWARE_NAMES: Partial<Record<Software, RegExp>> = {
  appfolio: /\bappfolio\b/i,
  buildium: /\bbuildium\b/i,
  doorloop: /\bdoorloop\b/i,
  rent_manager: /\brent ?manager\b/i,
  yardi: /\b(yardi|rentcafe)\b/i,
  propertyware: /\bpropertyware\b/i,
  rentvine: /\brentvine\b/i,
  tenantcloud: /\btenantcloud\b/i,
};
