/**
 * Semantic color tokens: the single source of truth. app/globals.css mirrors
 * these values, and lib/design/contrast.test.ts proves every pair passes WCAG.
 * See docs/design-contract.md for what each token is for.
 */
const light = {
  background: "#F7F5F0",
  foreground: "#0F2A44",
  card: "#FFFFFF",
  "card-foreground": "#0F2A44",
  muted: "#EFECE4",
  "muted-foreground": "#4A5566",
  primary: "#0F2A44",
  "primary-foreground": "#FFFFFF",
  /** Gold: fills, rules and meters only. Never text on light backgrounds. */
  accent: "#E3A72F",
  "accent-foreground": "#0F2A44",
  link: "#8C5F0A",
  success: "#1E7A4C",
  warning: "#8A5A00",
  destructive: "#B42318",
  "destructive-foreground": "#FFFFFF",
  /** Decorative dividers only; never the sole boundary of a control. */
  border: "#D9D4C7",
  input: "#6F7A8A",
  /** Focus outline. Light theme adds a gold halo outside it for decoration. */
  ring: "#0F2A44",
  "ring-halo": "#E3A72F",
  "chart-1": "#0F2A44",
  "chart-2": "#8C5F0A",
} as const;

export type TokenName = keyof typeof light;

const dark: Record<TokenName, string> = {
  background: "#0B1B2E",
  foreground: "#E8EDF3",
  card: "#12263D",
  "card-foreground": "#E8EDF3",
  muted: "#1A3150",
  "muted-foreground": "#A9B4C2",
  primary: "#E3A72F",
  "primary-foreground": "#0B1B2E",
  accent: "#E3A72F",
  "accent-foreground": "#0B1B2E",
  link: "#E3A72F",
  success: "#4CC38A",
  warning: "#F0B44C",
  destructive: "#F97066",
  "destructive-foreground": "#0B1B2E",
  border: "#24395A",
  input: "#6B7B91",
  ring: "#E3A72F",
  "ring-halo": "#E3A72F",
  "chart-1": "#8EC5FF",
  "chart-2": "#E3A72F",
};

export const themes = { light, dark } satisfies Record<string, Record<TokenName, string>>;
export type ThemeName = keyof typeof themes;
