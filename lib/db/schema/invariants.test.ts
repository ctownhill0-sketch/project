import { describe, it, expect } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table));

/** Every table in brief Part 6, plus the local-auth and import-mapping additions. */
const EXPECTED_TABLES = [
  // workspace
  "workspace",
  "app_user",
  "membership",
  // leads
  "company",
  "contact",
  "tag",
  "company_tag",
  "import_batch",
  "import_mapping",
  "software_pattern",
  "detection_run",
  "score_history",
  // listings and reviews (deferred modules; tables exist, stay empty)
  "listing",
  "listing_snapshot",
  "alert",
  "review",
  "review_classification",
  // mystery shops
  "mystery_shop",
];

/** Tables that sit above the workspace boundary. */
const OWNERSHIP_EXEMPT = new Set(["workspace", "app_user"]);

/**
 * Fair housing (brief Part 11): never store protected characteristics.
 * Matched against whole snake_case segments, so `created_at` never trips `age`.
 */
const BANNED_SEGMENTS = new Set([
  "race",
  "races",
  "racial",
  "ethnic",
  "ethnicity",
  "religion",
  "religious",
  "creed",
  "color",
  "colour",
  "sex",
  "gender",
  "pregnant",
  "pregnancy",
  "disability",
  "disabled",
  "handicap",
  "age",
  "dob",
  "birth",
  "birthdate",
  "birthday",
  "marital",
  "orientation",
  "citizenship",
  "immigration",
  "veteran",
  "military",
  "nationality",
  "familial",
  "children",
  "kids",
]);
const BANNED_PHRASES = ["national_origin", "source_of_income", "income_source", "family_status"];

describe("schema invariants", () => {
  it("contains exactly the tables in the data model", () => {
    expect(tables.map((t) => t.name).sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  it.each(tables.filter((t) => !OWNERSHIP_EXEMPT.has(t.name)).map((t) => [t.name, t] as const))(
    "%s has workspace, creator and timestamp columns",
    (_name, table) => {
      const names = table.columns.map((c) => c.name);
      expect(names).toEqual(
        expect.arrayContaining(["id", "workspace_id", "created_by_id", "created_at", "updated_at"]),
      );
    },
  );

  it("never has a column for a protected characteristic", () => {
    const offenders = tables.flatMap((t) =>
      t.columns
        .map((c) => c.name)
        .filter(
          (name) =>
            name.split("_").some((segment) => BANNED_SEGMENTS.has(segment)) ||
            BANNED_PHRASES.some((phrase) => name.includes(phrase)),
        )
        .map((name) => `${t.name}.${name}`),
    );
    expect(offenders).toEqual([]);
  });
});
