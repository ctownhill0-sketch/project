"use client";

import { Icons } from "@/components/icons";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

/** Opens ⌘K. "wide" in the sidebar, icon-only in the compact top bar. */
export function SearchTrigger({ variant = "wide" }: { variant?: "wide" | "icon" }) {
  const { openCommand } = useShell();
  if (variant === "icon") {
    return (
      <Button variant="ghost" size="icon-lg" onClick={openCommand} aria-label="Open command menu">
        <Icons.search />
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={openCommand}
      className="border-input bg-card text-muted-foreground hover:text-foreground flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left"
    >
      <Icons.search className="size-4" />
      <span className="flex-1">Jump to…</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}
