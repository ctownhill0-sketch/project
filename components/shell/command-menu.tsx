"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { pushRecent, readRecent, type RecentItem } from "@/components/shell/recent";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

interface LeadHit {
  id: string;
  name: string;
  city: string | null;
  score: number;
}

const ACTIONS: RecentItem[] = [
  { label: "Find leads in a town", href: "/finder" },
  { label: "Log a mystery shop", href: "/shops?new=1" },
  { label: "Start a call block", href: "/calls?mode=block" },
  { label: "New audit", href: "/audits?new=1" },
];

export function CommandMenu({
  open,
  onOpenChange,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();
  // The provider remounts this menu each time it opens, so state starts fresh.
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const [recent] = useState<RecentItem[]>(() => (typeof window === "undefined" ? [] : readRecent()));
  const q = query.trim();
  const visibleLeads = q ? leads : [];

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results: LeadHit[] }) => setLeads(data.results))
        .catch(() => {});
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const go = (item: RecentItem) => {
    pushRecent(item);
    onOpenChange(false);
    router.push(item.href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command menu"
      description="Jump to a lead, page or action"
    >
      <Command>
        <CommandInput
          placeholder="Search leads by name, town or phone, or type a page"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            No matches. Try a firm name, a town or the last 4 digits of a phone number.
          </CommandEmpty>
          {recent.length > 0 && !query ? (
            <CommandGroup heading="Recent">
              {recent.map((r) => (
                <CommandItem key={`recent-${r.href}`} value={`recent ${r.label}`} onSelect={() => go(r)}>
                  {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {visibleLeads.length > 0 ? (
            <CommandGroup heading="Leads">
              {visibleLeads.map((l) => (
                <CommandItem
                  key={l.id}
                  value={`${l.name} ${l.city ?? ""} ${query}`}
                  onSelect={() => go({ label: l.name, href: `/leads?lead=${l.id}` })}
                >
                  <Icons.leads />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-muted-foreground">{l.city}</span>
                  <span className="num text-muted-foreground w-8 text-right">{l.score}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Actions">
            {ACTIONS.map((a) => (
              <CommandItem key={a.href} value={a.label} onSelect={() => go(a)}>
                {a.label}
              </CommandItem>
            ))}
            <CommandItem
              value="Keyboard shortcuts"
              onSelect={() => {
                onOpenChange(false);
                onShowShortcuts();
              }}
            >
              <Icons.keyboard />
              Keyboard shortcuts
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map((item) => {
              const Icon = Icons[item.icon];
              return (
                <CommandItem
                  key={item.href}
                  value={`page ${item.label}`}
                  onSelect={() => go({ label: item.label, href: item.href })}
                >
                  <Icon />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
