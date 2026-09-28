export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "vd-theme";

/** The viewer's saved choice wins; otherwise follow the operating system. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Inlined in <head> so the right theme is set before first paint (no flash).
 * Kept dependency-free; storage can throw in private windows, so it's guarded.
 */
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",s==="light"||s==="dark"?s:(d?"dark":"light"))})();`;
