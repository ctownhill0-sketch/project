"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";
import type { NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

interface NavListProps {
  items: NavItem[];
  onNavigate?: () => void;
  /** "bar" = compact phone bottom bar with stacked icon + label. */
  layout?: "list" | "bar";
}

/** Nav links: no animation (used many times a day), aria-current on the active page. */
export function NavList({ items, onNavigate, layout = "list" }: NavListProps) {
  const pathname = usePathname();
  return (
    <ul className={cn(layout === "bar" ? "grid auto-cols-fr grid-flow-col" : "flex flex-col gap-1")}>
      {items.map((item) => {
        const Icon = Icons[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-small text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground flex items-center rounded-lg font-medium",
                layout === "bar"
                  ? "text-caption min-h-11 flex-col justify-center gap-0.5 px-1"
                  : "min-h-10 gap-3 px-3",
              )}
            >
              <Icon className={layout === "bar" ? "size-5" : "size-4"} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
