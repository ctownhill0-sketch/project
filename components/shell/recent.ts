"use client";

export interface RecentItem {
  label: string;
  href: string;
}

const KEY = "vd-recent";

/** Recently opened items for ⌘K. Per-viewer convenience only; storage may be blocked. */
export function readRecent(): RecentItem[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem): void {
  try {
    const next = [item, ...readRecent().filter((r) => r.href !== item.href)].slice(0, 5);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows can block storage; recents just won't persist.
  }
}
