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
      .replace(/\bshadow-xs\b/g, "shadow-sm")
      .replace(/\bshadow-(xl|2xl)\b/g, "shadow-lg")
  );
}
