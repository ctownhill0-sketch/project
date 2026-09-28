import { describe, it, expect } from "vitest";
import { pgTable, text, getTableConfig } from "drizzle-orm/pg-core";
import { baseColumns } from "@/lib/db/columns";

describe("baseColumns", () => {
  const probe = pgTable("probe", { ...baseColumns(), name: text() });
  const columns = Object.fromEntries(getTableConfig(probe).columns.map((c) => [c.name, c]));

  it("adds id, workspace, creator and timestamps in snake_case", () => {
    expect(Object.keys(columns).sort()).toEqual(
      ["created_at", "created_by_id", "id", "name", "updated_at", "workspace_id"].sort(),
    );
  });

  it("makes id a defaulted primary key and ownership columns required", () => {
    expect(columns.id?.primary).toBe(true);
    expect(columns.id?.hasDefault).toBe(true);
    expect(columns.workspace_id?.notNull).toBe(true);
    expect(columns.created_by_id?.notNull).toBe(true);
    expect(columns.created_at?.hasDefault).toBe(true);
  });
});
