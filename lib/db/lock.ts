import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCK_FILE = "pglite.lock";

export const LOCKED_MESSAGE =
  "Another copy of the app is using the database. Close it (Ctrl + C in its Terminal) and try again.";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 only checks that the process exists
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else: still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readOwner(file: string): number | undefined {
  try {
    const pid = Number.parseInt(readFileSync(file, "utf8").trim(), 10);
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * PGlite is a single-process database. This lock stops a second `pnpm dev`
 * (or a script) from opening the same data folder and corrupting it.
 */
export function acquireLock(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, LOCK_FILE);
  try {
    // Exclusive create: if two processes start together, only one can win.
    writeFileSync(file, String(process.pid), { flag: "wx" });
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const owner = readOwner(file);
  if (owner !== undefined && owner !== process.pid && isAlive(owner)) {
    throw new Error(LOCKED_MESSAGE);
  }
  // Stale lock (its process has exited) or already ours: take it over.
  writeFileSync(file, String(process.pid));
}

export function releaseLock(dir: string): void {
  const file = path.join(dir, LOCK_FILE);
  if (readOwner(file) === process.pid) rmSync(file, { force: true });
}
