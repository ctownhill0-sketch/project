import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "@/lib/db/test-db";

describe("migrations", () => {
  it("create every table on a fresh database", async () => {
    const { db, close } = await createTestDb();
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = result.rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["company", "mystery_shop", "deal", "audit_log"]));
    expect(names).toHaveLength(46); // must match EXPECTED_TABLES in schema/invariants.test.ts;
    await close();
  });
});
