"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1280px)";

/** True at ≥1280px, where list and detail sit side by side. Server render assumes wide. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
