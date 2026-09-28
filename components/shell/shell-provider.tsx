"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createHotkeyMatcher } from "@/lib/hotkeys";
import { CommandMenu } from "@/components/shell/command-menu";
import { ShellContext } from "@/components/shell/shell-context";
import { ShortcutsDialog } from "@/components/shell/shortcuts-dialog";

const EDITABLE = "input, textarea, select, [contenteditable='true'], [role='combobox']";

/** Owns the command menu, the shortcuts sheet and the global keyboard map. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [commandOpen, setCommandOpenState] = useState(false);
  // A new key each time the menu opens remounts it with fresh state.
  const [menuKey, setMenuKey] = useState(0);
  const setCommandOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    setCommandOpenState((open) => {
      const value = typeof next === "function" ? next(open) : next;
      if (value && !open) setMenuKey((k) => k + 1);
      return value;
    });
  }, []);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const matcher = createHotkeyMatcher();
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inEditable = Boolean(target?.closest?.(EDITABLE));
      const action = matcher.handle(
        { key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey, inEditable },
        performance.now(),
      );
      if (!action) return;
      // While a dialog is open, only ⌘K (toggle) is global.
      const dialogOpen = Boolean(document.querySelector("[role='dialog']"));
      if (dialogOpen && action.type !== "command") return;
      event.preventDefault();
      if (action.type === "command" || action.type === "search")
        setCommandOpen((open) => !open || action.type === "search");
      else if (action.type === "help") setShortcutsOpen(true);
      else router.push(action.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setCommandOpen]);

  const api = useMemo(
    () => ({ openCommand: () => setCommandOpen(true), openShortcuts: () => setShortcutsOpen(true) }),
    [setCommandOpen],
  );
  return (
    <ShellContext.Provider value={api}>
      {children}
      <CommandMenu
        key={menuKey}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </ShellContext.Provider>
  );
}
