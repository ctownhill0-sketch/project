"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False in the server render and during hydration, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
