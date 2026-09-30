import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { company } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import { canBackUpWholeDatabase, exportWorkspace } from "@/lib/settings/export";
import { createTestDb as freshDb } from "@/lib/db/test-db";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

describe("exportWorkspace", () => {
  it("exports every workspace table, only for this workspace", async () => {
    const mine = await insertOwner(handle.db);
    const other = await insertOwner(handle.db);
    await handle.db.insert(company).values([
      { ...mine.own, name: "Mine", normalizedName: "mine" },
      { ...other.own, name: "Theirs", normalizedName: "theirs" },
    ]);
    const out = await exportWorkspace(handle.db, mine.workspaceId, new Date("2026-09-30T12:00:00Z"));
    expect(out.exportedAt).toBe("2026-09-30T12:00:00.000Z");
    expect(out.tables.company!.map((c) => c.name)).toEqual(["Mine"]);
    expect(Object.keys(out.tables)).toEqual(
      expect.arrayContaining(["company", "mystery_shop", "audit_log", "setting"]),
    );
    expect(JSON.stringify(out)).not.toContain("Theirs");
  });

  it("offers a gzip backup of the PGlite data directory", async () => {
    const blob = await handle.backup!();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
  });

  it("allows a whole-database backup only while one workspace exists", async () => {
    const solo = await freshDb();
    await insertOwner(solo.db);
    expect(await canBackUpWholeDatabase(solo.db)).toBe(true);
    await insertOwner(solo.db);
    expect(await canBackUpWholeDatabase(solo.db)).toBe(false);
    await solo.close();
  });
});
