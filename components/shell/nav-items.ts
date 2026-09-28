import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar, where space is tight. */
  shortLabel?: string;
  icon: IconName;
  /** Which Free Build step builds this module (shown on placeholder pages). */
  step: number;
  /** Shown in the phone bottom bar (brief 8.8: alerts, shop replies, quick dashboard). */
  onPhoneBar?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", step: 10, onPhoneBar: true },
  { href: "/leads", label: "Leads", icon: "leads", step: 2 },
  { href: "/shops", label: "Mystery shops", shortLabel: "Shops", icon: "shops", step: 3, onPhoneBar: true },
  { href: "/calls", label: "Calls", icon: "calls", step: 4, onPhoneBar: true },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline", step: 5 },
  { href: "/roi", label: "ROI", icon: "roi", step: 6 },
  { href: "/audits", label: "Audits", icon: "audits", step: 7 },
  { href: "/pilots", label: "Pilots", icon: "pilots", step: 9 },
  { href: "/settings", label: "Settings", icon: "settings", step: 10 },
  { href: "/design", label: "Design system", icon: "design", step: 1 },
];

export function navLabel(href: string): string {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item.label;
}
