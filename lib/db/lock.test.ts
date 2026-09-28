import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { acquireLock, releaseLock } from "@/lib/db/lock";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "vd-lock-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("pglite lock", () => {
  it("writes a lock file with this process id", () => {
    acquireLock(dir);
    expect(readFileSync(path.join(dir, "pglite.lock"), "utf8").trim()).toBe(String(process.pid));
  });

  it("refuses a second copy while the first process is alive", () => {
    // Our parent process is alive and is not us: it stands in for "another copy of the app".
    writeFileSync(path.join(dir, "pglite.lock"), String(process.ppid));
    expect(() => acquireLock(dir)).toThrow(
      "Another copy of the app is using the database. Close it (Ctrl + C in its Terminal) and try again.",
    );
  });

  it("takes over a stale lock left by a process that has exited", () => {
    writeFileSync(path.join(dir, "pglite.lock"), "999999999");
    expect(() => acquireLock(dir)).not.toThrow();
  });

  it("releases only its own lock", () => {
    acquireLock(dir);
    releaseLock(dir);
    expect(() => readFileSync(path.join(dir, "pglite.lock"))).toThrow();
  });
});
