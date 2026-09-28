"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RecordItem {
  id: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
}

interface RecordListProps {
  items: RecordItem[];
  selectedId: string | null;
  /** URL prefix for a record, e.g. "/leads?lead=". Selection lives in the URL so records are linkable.
   *  (A string, not a function, so server components can pass it.) */
  hrefPrefix: string;
  label: string;
}

const EDITABLE = "input, textarea, select, [contenteditable='true'], [role='combobox']";

/**
 * A keyboard-first record list (listbox + aria-activedescendant).
 * J/K or ↓/↑ move the selection, Enter opens it. No animation: used many times a day.
 */
export function RecordList({ items, selectedId, hrefPrefix, label }: RecordListProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === selectedId),
  );

  const select = (i: number, open = false) => {
    const item = items[Math.min(items.length - 1, Math.max(0, i))];
    if (!item) return;
    const href = `${hrefPrefix}${item.id}`;
    if (open) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  // J/K work anywhere on the page (not while typing or in a dialog).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(EDITABLE) || document.querySelector("[role='dialog']")) return;
      if (ref.current?.contains(target)) return; // handled by onKeyDown below
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        select(index + (e.key === "j" ? 1 : -1));
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      select(index + 1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      select(index - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(index, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(items.length - 1);
    }
  };

  const activeId = items[index] ? `record-${items[index].id}` : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={activeId}
      onKeyDown={onKeyDown}
      className="flex flex-col outline-offset-[-2px]"
    >
      {items.map((item, i) => {
        const selected = item.id === selectedId;
        return (
          // Keyboard is handled on the listbox (aria-activedescendant), so options take clicks only.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div
            key={item.id}
            id={`record-${item.id}`}
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            onClick={() => select(i, true)}
            className={cn(
              "border-border hover:bg-muted relative flex cursor-default items-start gap-3 border-b px-4 py-3 last:border-b-0",
              selected &&
                "bg-muted before:bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{item.title}</span>
              {item.subtitle ? (
                <span className="text-small text-muted-foreground truncate">{item.subtitle}</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              {item.badge}
              {item.meta ? <span className="text-small text-muted-foreground num">{item.meta}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
