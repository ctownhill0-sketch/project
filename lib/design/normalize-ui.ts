/**
 * Brings shadcn registry components in line with docs/design-contract.md after
 * `pnpm ui:add`. Pure string transform so it can be unit-tested.
 */
export function normalizeUiSource(source: string): string {
  return (
    source
      // `dark:` variants inside class strings: " dark:x" anywhere, or "dark:x " right after a quote.
      .replace(/ dark:[\w\-[\]/:.%()&*>=#,]+/g, "")
      .replace(/(["'`])dark:[\w\-[\]/:.%()&*>=#,]+ */g, "$1")
      .replace(
        /\btransition-all\b/g,
        "transition-[color,background-color,border-color,box-shadow,opacity,scale]",
      )
      // Brief 8.6: pressed controls scale to 0.97 (the variable is 1 under reduced motion).
      .replace(
        /(active:[\w\-[\]]*:?)translate-y-px\b/g,
        "$1scale-(--press-scale) duration-(--duration-press) ease-out",
      )
      // Translucent text fails contrast on tinted fills; use tokens that are tested.
      .replace(/(hover:)text-foreground\/\d+\b/g, "$1text-foreground")
      .replace(/\btext-foreground\/\d+\b/g, "text-muted-foreground")
      // Outline buttons need a visible 3:1 edge; --border is decorative only (design contract §2).
      .replace(/(outline:\s*\n?\s*"[^"]*?)border-border bg-background/g, "$1border-input bg-card")
      .replace(/\bshadow-xs\b/g, "shadow-sm")
      .replace(/\bshadow-(xl|2xl)\b/g, "shadow-lg")
  );
}
