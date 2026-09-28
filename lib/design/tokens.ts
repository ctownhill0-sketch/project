/**
 * Semantic color tokens: the single source of truth. app/globals.css mirrors
 * these values, and lib/design/contrast.test.ts proves every pair passes WCAG.
 * See docs/design-contract.md for what each token is for.
 */
/**
 * Palette: Graphite (neutral graphite + deep indigo), chosen at Checkpoint P.
 * Values mirror docs/palettes/palettes.mjs (lib/design/palette-choice.test.ts keeps them in sync).
 * Status text (success/warning/destructive/info) only sits on surfaces; icons may touch the background.
 * "border" is decorative; "input" is the ≥3:1 control boundary.
 */
const light = {
  background: "#F6F6F7",
  foreground: "#17171C",
  card: "#FFFFFF",
  "card-foreground": "#17171C",
  popover: "#FFFFFF",
  "popover-foreground": "#17171C",
  muted: "#EDEDF1",
  "muted-foreground": "#50505C",
  secondary: "#EDEDF1",
  "secondary-foreground": "#17171C",
  primary: "#4338CA",
  "primary-foreground": "#FFFFFF",
  accent: "#5A5CE6",
  "accent-foreground": "#FFFFFF",
  link: "#4338CA",
  success: "#2D8014",
  warning: "#774500",
  destructive: "#D74030",
  /** Inline error text on any background; `destructive` is the status/icon tone. */
  "destructive-text": "#A8212E",
  "destructive-foreground": "#FFFFFF",
  info: "#3A6FA3",
  border: "#DBDBE1",
  input: "#737383",
  ring: "#4338CA",
  "ring-halo": "#4338CA",
  "chart-1": "#697EDA",
  "chart-2": "#89401C",
  "chart-3": "#0D9F66",
  "chart-4": "#916607",
  "chart-5": "#DC428A",
  sidebar: "#FFFFFF",
  "sidebar-foreground": "#17171C",
  "sidebar-primary": "#4338CA",
  "sidebar-primary-foreground": "#FFFFFF",
  "sidebar-accent": "#EDEDF1",
  "sidebar-accent-foreground": "#17171C",
  "sidebar-border": "#DBDBE1",
  "sidebar-ring": "#4338CA",
} as const;

export type TokenName = keyof typeof light;

const dark: Record<TokenName, string> = {
  background: "#0E0E12",
  foreground: "#ECECF1",
  card: "#16161C",
  "card-foreground": "#ECECF1",
  popover: "#1D1D25",
  "popover-foreground": "#ECECF1",
  muted: "#22222B",
  "muted-foreground": "#A7A7B4",
  secondary: "#22222B",
  "secondary-foreground": "#ECECF1",
  primary: "#8E92F7",
  "primary-foreground": "#11113A",
  accent: "#8E92F7",
  "accent-foreground": "#11113A",
  link: "#A7AAF9",
  success: "#5FD37F",
  warning: "#EE921A",
  destructive: "#F0555B",
  "destructive-text": "#F47A7F",
  "destructive-foreground": "#0E0E12",
  info: "#88ABEA",
  border: "#2E2E39",
  input: "#72727F",
  ring: "#A7AAF9",
  "ring-halo": "#A7AAF9",
  "chart-1": "#596CC6",
  "chart-2": "#9A5426",
  "chart-3": "#2D9570",
  "chart-4": "#976C14",
  "chart-5": "#A15884",
  sidebar: "#16161C",
  "sidebar-foreground": "#ECECF1",
  "sidebar-primary": "#8E92F7",
  "sidebar-primary-foreground": "#11113A",
  "sidebar-accent": "#22222B",
  "sidebar-accent-foreground": "#ECECF1",
  "sidebar-border": "#2E2E39",
  "sidebar-ring": "#A7AAF9",
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
