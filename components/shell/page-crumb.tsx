"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/shell/nav-items";

/** Current page name in the top bar. */
export function PageCrumb() {
  const pathname = usePathname();
  const item = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return <span className="text-foreground font-medium">{item?.label ?? "Vacancy Desk"}</span>;
}
