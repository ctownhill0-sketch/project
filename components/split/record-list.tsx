"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { scrollIntoList } from "@/components/split/scroll-into-list";
import { useRecordKeys } from "@/components/split/use-record-keys";
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

/**
 * A keyboard-first record list (listbox + aria-activedescendant).
 * J/K or ↓/↑ move the selection, Enter opens it. No animation: used many times a day.
 */
export function RecordList({ items, selectedId, hrefPrefix, label }: RecordListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { index, select, onKeyDown } = useRecordKeys({
    ids: items.map((i) => i.id),
    selectedId,
    hrefPrefix,
    containerRef: ref,
  });

  const activeId = items[index] ? `record-${items[index].id}` : undefined;
  useEffect(() => {
    if (activeId) scrollIntoList(document.getElementById(activeId));
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
