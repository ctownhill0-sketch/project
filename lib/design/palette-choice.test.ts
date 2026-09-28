import { describe, expect, it } from "vitest";
import { PALETTES } from "../../docs/palettes/palettes.mjs";
import { themes, type TokenName } from "@/lib/design/tokens";

/** How the Checkpoint P palette tokens map onto the app's (shadcn-style) token names. */
const MAP: Record<TokenName, string> = {
  background: "background",
  foreground: "foreground",
  card: "surface",
  "card-foreground": "foreground",
  popover: "surface-raised",
  "popover-foreground": "foreground",
  muted: "subtle",
  "muted-foreground": "muted-foreground",
  secondary: "subtle",
  "secondary-foreground": "foreground",
  primary: "primary",
  "primary-foreground": "primary-foreground",
  accent: "accent",
  "accent-foreground": "accent-foreground",
  link: "link",
  success: "success",
  warning: "warning",
  destructive: "destructive",
  "destructive-foreground": "destructive-foreground",
  "destructive-text": "destructive-text",
  info: "info",
  border: "border",
  input: "border-strong",
  ring: "ring",
  "ring-halo": "ring",
  "chart-1": "chart-1",
  "chart-2": "chart-2",
  "chart-3": "chart-3",
  "chart-4": "chart-4",
  "chart-5": "chart-5",
  sidebar: "surface",
  "sidebar-foreground": "foreground",
  "sidebar-primary": "primary",
  "sidebar-primary-foreground": "primary-foreground",
  "sidebar-accent": "subtle",
  "sidebar-accent-foreground": "foreground",
  "sidebar-border": "border",
  "sidebar-ring": "ring",
};

describe("tokens follow the chosen palette (Graphite, Checkpoint P)", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`${mode} theme`, () => {
      const chosen = PALETTES.graphite[mode] as Record<string, string>;
      for (const [token, source] of Object.entries(MAP)) {
        if (token === "destructive-foreground") continue; // not in the palette sheet; checked by contrast tests
        expect
          .soft(themes[mode][token as TokenName]?.toUpperCase(), token)
          .toBe(chosen[source]?.toUpperCase());
      }
    });
  }
});
