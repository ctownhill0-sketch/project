import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("defaults DATABASE_DRIVER to pglite", () => {
    expect(parseEnv({}).DATABASE_DRIVER).toBe("pglite");
  });

  it("rejects unknown drivers with a readable message", () => {
    expect(() => parseEnv({ DATABASE_DRIVER: "mysql" })).toThrow(/DATABASE_DRIVER/);
  });
});
