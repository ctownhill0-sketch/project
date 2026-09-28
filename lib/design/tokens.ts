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
  // Tokens shadcn components expect, mapped onto the same palette.
  popover: "#FFFFFF",
  "popover-foreground": "#0F2A44",
  secondary: "#EFECE4",
  "secondary-foreground": "#0F2A44",
  sidebar: "#FFFFFF",
  "sidebar-foreground": "#0F2A44",
  "sidebar-primary": "#0F2A44",
  "sidebar-primary-foreground": "#FFFFFF",
  "sidebar-accent": "#EFECE4",
  "sidebar-accent-foreground": "#0F2A44",
  "sidebar-border": "#D9D4C7",
  "sidebar-ring": "#0F2A44",
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
  popover: "#12263D",
  "popover-foreground": "#E8EDF3",
  secondary: "#1A3150",
  "secondary-foreground": "#E8EDF3",
  sidebar: "#12263D",
  "sidebar-foreground": "#E8EDF3",
  "sidebar-primary": "#E3A72F",
  "sidebar-primary-foreground": "#0B1B2E",
  "sidebar-accent": "#1A3150",
  "sidebar-accent-foreground": "#E8EDF3",
  "sidebar-border": "#24395A",
  "sidebar-ring": "#E3A72F",
};

export const themes = { light, dark } satisfies Record<string, Record<TokenName, string>>;
export type ThemeName = keyof typeof themes;

/** Exactly three shadows (brief 8.5). sm: controls · md: cards, popovers · lg: modals only. */
export const shadows = {
  sm: "0px 2px 3px -1px rgba(0,0,0,0.1), 0px 1px 0px 0px rgba(25,28,33,0.02), 0px 0px 0px 1px rgba(25,28,33,0.08)",
  md: "0px 0px 0px 1px rgba(0,0,0,0.06), 0px 1px 1px -0.5px rgba(0,0,0,0.06), 0px 3px 3px -1.5px rgba(0,0,0,0.06), 0px 6px 6px -3px rgba(0,0,0,0.06), 0px 12px 12px -6px rgba(0,0,0,0.06), 0px 24px 24px -12px rgba(0,0,0,0.06)",
  lg: "0 2.8px 2.2px rgba(0,0,0,0.034), 0 6.7px 5.3px rgba(0,0,0,0.048), 0 12.5px 10px rgba(0,0,0,0.06), 0 22.3px 17.9px rgba(0,0,0,0.072), 0 41.8px 33.4px rgba(0,0,0,0.086), 0 100px 80px rgba(0,0,0,0.12)",
} as const;

/** Milliseconds (brief 8.6). */
export const durations = { color: 100, press: 120, tooltip: 150, dropdown: 180, dialog: 240 } as const;

export const easings = {
  out: "cubic-bezier(0.23,1,0.32,1)",
  inOut: "cubic-bezier(0.77,0,0.175,1)",
  drawer: "cubic-bezier(0.32,0.72,0,1)",
} as const;

/** Pixels: controls, cards, modals. Nested radius = outer radius − padding. */
export const radii = { control: 8, card: 12, modal: 16 } as const;

/** Font size / line height in px. */
export const typeScale = [
  { name: "display", size: 48, line: 56 },
  { name: "h1", size: 36, line: 44 },
  { name: "h2", size: 28, line: 36 },
  { name: "h3", size: 22, line: 30 },
  { name: "body", size: 16, line: 24 },
  { name: "small", size: 14, line: 20 },
  { name: "caption", size: 12, line: 16 },
] as const;
