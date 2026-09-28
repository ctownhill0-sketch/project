"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/use-theme";

/** Theme toggle (toggles.dev pattern): a real button, no animation, follows the system until used. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Icons.sun /> : <Icons.moon />}
    </Button>
  );
}
