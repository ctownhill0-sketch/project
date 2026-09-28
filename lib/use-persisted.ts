"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-viewer UI preferences (density, visible columns). Browser storage can be missing or throw
// (private windows, blocked site data), so reads and writes are guarded, with an in-memory fallback.
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string | undefined {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Storage unavailable.
  }
  return memory.get(key);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A string preference kept in this browser. The server render always uses the fallback. */
export function usePersisted(key: string, fallback: string): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage unavailable: the in-memory value lasts until reload.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
