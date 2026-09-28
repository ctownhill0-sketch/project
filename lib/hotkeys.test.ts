import { describe, expect, it } from "vitest";
import { createHotkeyMatcher, type KeyInput } from "@/lib/hotkeys";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  inEditable: false,
  ...extra,
});

describe("hotkey matcher", () => {
  it("opens the command menu on ⌘K or Ctrl+K", () => {
    const m = createHotkeyMatcher();
    expect(m.handle(key("k", { metaKey: true }), 0)).toEqual({ type: "command" });
    expect(m.handle(key("k", { ctrlKey: true }), 0)).toEqual({ type: "command" });
  });

  it("runs G-then-letter navigation within 1 second", () => {
    const m = createHotkeyMatcher();
    expect(m.handle(key("g"), 0)).toBeNull();
    expect(m.handle(key("l"), 400)).toEqual({ type: "go", href: "/leads" });
    expect(m.handle(key("g"), 1000)).toBeNull();
    expect(m.handle(key("d"), 3000)).toBeNull(); // too slow: sequence expired
  });

  it("maps G then D/L/C/P", () => {
    const go = (letter: string) => {
      const m = createHotkeyMatcher();
      m.handle(key("g"), 0);
      return m.handle(key(letter), 10);
    };
    expect(go("d")).toEqual({ type: "go", href: "/dashboard" });
    expect(go("c")).toEqual({ type: "go", href: "/calls" });
    expect(go("p")).toEqual({ type: "go", href: "/pipeline" });
  });

  it("opens search with / and the shortcut sheet with ?", () => {
    const m = createHotkeyMatcher();
    expect(m.handle(key("/"), 0)).toEqual({ type: "search" });
    expect(m.handle(key("?"), 0)).toEqual({ type: "help" });
  });

  it("ignores single keys while typing in a field, but still allows ⌘K", () => {
    const m = createHotkeyMatcher();
    expect(m.handle(key("g", { inEditable: true }), 0)).toBeNull();
    expect(m.handle(key("l", { inEditable: true }), 10)).toBeNull();
    expect(m.handle(key("/", { inEditable: true }), 10)).toBeNull();
    expect(m.handle(key("k", { metaKey: true, inEditable: true }), 10)).toEqual({ type: "command" });
  });
});
