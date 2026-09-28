import { describe, expect, it } from "vitest";
import { getDb, resetDbCacheForTests } from "@/lib/db";

describe("getDb", () => {
  it("returns one shared connection per process", async () => {
    const env = { DATABASE_DRIVER: "pglite", PGLITE_DIR: "memory://" };
    const first = await getDb(env);
    const second = await getDb(env);
    expect(second).toBe(first);
  });
});

describe("getDb after a failed open", () => {
  it("tries again on the next call instead of caching the failure", async () => {
    resetDbCacheForTests();
    await expect(getDb({ DATABASE_DRIVER: "neon" })).rejects.toThrow(/DATABASE_URL/);
    await expect(getDb({ DATABASE_DRIVER: "pglite", PGLITE_DIR: "memory://" })).resolves.toBeDefined();
  });
});
