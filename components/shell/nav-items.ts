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
  group: NavGroup;
}

export type NavGroup = "top" | "Find" | "Sell" | "Prove" | "Setup";
export const NAV_GROUPS: NavGroup[] = ["top", "Find", "Sell", "Prove", "Setup"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", step: 10, onPhoneBar: true, group: "top" },
  { href: "/finder", label: "Lead finder", icon: "finder", step: 2, group: "Find" },
  { href: "/leads", label: "Leads", icon: "leads", step: 2, group: "Sell" },
  {
    href: "/shops",
    label: "Mystery shops",
    shortLabel: "Shops",
    icon: "shops",
    step: 3,
    onPhoneBar: true,
    group: "Sell",
  },
  { href: "/calls", label: "Calls", icon: "calls", step: 4, onPhoneBar: true, group: "Sell" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline", step: 5, group: "Sell" },
  { href: "/roi", label: "ROI", icon: "roi", step: 6, group: "Prove" },
  { href: "/audits", label: "Audits", icon: "audits", step: 7, group: "Prove" },
  { href: "/pilots", label: "Pilots", icon: "pilots", step: 9, group: "Prove" },
  { href: "/settings", label: "Settings", icon: "settings", step: 10, group: "Setup" },
  { href: "/design", label: "Design system", icon: "design", step: 1, group: "Setup" },
];

export function navLabel(href: string): string {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item.label;
}
