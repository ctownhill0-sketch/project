"use client";

import { useRouter } from "next/navigation";
import { useEffect, type KeyboardEvent, type RefObject } from "react";

const EDITABLE = "input, textarea, select, [contenteditable='true'], [role='combobox']";

/**
 * Keyboard for a record list or grid. Selection lives in the URL (`hrefPrefix + id`), so records are
 * linkable. J/K work anywhere on the page (not while typing or in a dialog); inside the container,
 * arrows, Home/End and Enter work too. Moving replaces the URL; Enter and clicks push it.
 */
export function useRecordKeys({
  ids,
  selectedId,
  hrefPrefix,
  containerRef,
}: {
  ids: string[];
  selectedId: string | null;
  hrefPrefix: string;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const index = Math.max(0, ids.indexOf(selectedId ?? ""));

  const select = (i: number, open = false) => {
    const id = ids[Math.min(ids.length - 1, Math.max(0, i))];
    if (id === undefined) return;
    const href = `${hrefPrefix}${id}`;
    if (open) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(EDITABLE) || document.querySelector("[role='dialog']")) return;
      if (containerRef.current?.contains(target)) return; // handled by onKeyDown
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        select(index + (e.key === "j" ? 1 : -1));
        containerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return; // a control inside (e.g. a sort button) keeps its keys
    if (e.key === "ArrowDown" || e.key === "j") select(index + 1);
    else if (e.key === "ArrowUp" || e.key === "k") select(index - 1);
    else if (e.key === "Enter") select(index, true);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(ids.length - 1);
    else return;
    e.preventDefault();
  };

  return { index, select, onKeyDown };
}
