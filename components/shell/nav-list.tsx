"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";
import { NAV_GROUPS, type NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

interface NavListProps {
  items: NavItem[];
  onNavigate?: () => void;
  /** "bar" = compact phone bottom bar with stacked icon + label. */
  layout?: "list" | "bar";
  /** Show Find / Sell / Prove / Setup headings. */
  grouped?: boolean;
  /** Optional count badges keyed by href. */
  counts?: Record<string, number>;
}

/** Nav links: no animation (used many times a day), aria-current on the active page. */
export function NavList({ items, onNavigate, layout = "list", grouped = false, counts = {} }: NavListProps) {
  const pathname = usePathname();
  const link = (item: NavItem) => {
    const Icon = Icons[item.icon];
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const count = counts[item.href];
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          {...(onNavigate ? { onClick: onNavigate } : {})}
          aria-current={active ? "page" : undefined}
          className={cn(
            "text-small text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground aria-[current=page]:before:bg-accent relative flex items-center rounded-lg font-medium before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full",
            layout === "bar"
              ? "text-caption min-h-11 flex-col justify-center gap-0.5 px-1"
              : "min-h-9 gap-3 px-3",
          )}
        >
          <Icon className={layout === "bar" ? "size-5" : "size-4"} />
          {layout === "bar" ? (item.shortLabel ?? item.label) : item.label}
          {count !== undefined && layout !== "bar" ? (
            <span className="num bg-muted text-caption text-foreground ml-auto rounded-full px-2">
              {count}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  if (layout === "bar" || !grouped) {
    return (
      <ul className={cn(layout === "bar" ? "grid auto-cols-fr grid-flow-col" : "flex flex-col gap-1")}>
        {items.map(link)}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => {
        const inGroup = items.filter((i) => i.group === group);
        if (!inGroup.length) return null;
        return (
          <div key={group} className="flex flex-col gap-1">
            {group === "top" ? null : <h2 className="text-caption text-muted-foreground px-3">{group}</h2>}
            <ul className="flex flex-col gap-0.5">{inGroup.map(link)}</ul>
          </div>
        );
      })}
    </div>
  );
}
