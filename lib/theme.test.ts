import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("resolveTheme", () => {
  it("uses the stored choice when there is one", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the system otherwise, ignoring junk", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("purple", true)).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function run(stored: string | null, prefersDark: boolean, storageThrows = false) {
    const attrs: Record<string, string> = {};
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    const win = {
      localStorage: {
        getItem: (key: string) => {
          if (storageThrows) throw new Error("blocked");
          return key === THEME_STORAGE_KEY ? stored : null;
        },
      },
      matchMedia: () => ({ matches: prefersDark }),
    };
    new Function("window", "document", THEME_INIT_SCRIPT)(win, doc);
    return attrs["data-theme"];
  }

  it("sets data-theme before paint from storage or the system", () => {
    expect(run("dark", false)).toBe("dark");
    expect(run(null, true)).toBe("dark");
    expect(run(null, false)).toBe("light");
  });

  it("still works when storage is blocked", () => {
    expect(run("dark", true, true)).toBe("dark");
    expect(run("dark", false, true)).toBe("light");
  });
});
