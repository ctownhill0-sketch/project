import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";

describe("getDb", () => {
  it("returns one shared connection per process", async () => {
    const env = { DATABASE_DRIVER: "pglite", PGLITE_DIR: "memory://" };
    const first = await getDb(env);
    const second = await getDb(env);
    expect(second).toBe(first);
  });
});
