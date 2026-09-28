export interface KeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** Focus is in an input, textarea, select or contenteditable. */
  inEditable: boolean;
}

export type HotkeyAction =
  { type: "command" } | { type: "search" } | { type: "help" } | { type: "go"; href: string };

/** Keyboard map (brief §3): G then D/L/C/P, / search, ? help, ⌘K command menu. */
export const GO_KEYS: Record<string, { href: string; label: string }> = {
  d: { href: "/dashboard", label: "Dashboard" },
  l: { href: "/leads", label: "Leads" },
  c: { href: "/calls", label: "Calls" },
  p: { href: "/pipeline", label: "Pipeline" },
};

const SEQUENCE_MS = 1000;

export function createHotkeyMatcher() {
  let pendingG: number | null = null;
  return {
    handle(input: KeyInput, at: number): HotkeyAction | null {
      const key = input.key.toLowerCase();
      if ((input.metaKey || input.ctrlKey) && key === "k") return { type: "command" };
      if (input.inEditable || input.metaKey || input.ctrlKey || input.altKey) return null;
      if (pendingG !== null && at - pendingG <= SEQUENCE_MS && GO_KEYS[key]) {
        pendingG = null;
        return { type: "go", href: GO_KEYS[key].href };
      }
      pendingG = null;
      if (key === "g") {
        pendingG = at;
        return null;
      }
      if (input.key === "/") return { type: "search" };
      if (input.key === "?") return { type: "help" };
      return null;
    },
  };
}
