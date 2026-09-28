import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/lib/db/client";

describe("createDb", () => {
  it("runs a query against in-memory PGlite", async () => {
    const { db, close } = await createDb({ driver: "pglite", dir: "memory://" });
    const result = await db.execute<{ one: number }>(sql`select 1 as one`);
    expect(result.rows[0]?.one).toBe(1);
    await close();
  });

  it("requires a DATABASE_URL for the postgres driver", async () => {
    await expect(createDb({ driver: "neon" })).rejects.toThrow(/DATABASE_URL/);
  });
});
