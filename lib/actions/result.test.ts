import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";

describe("toResult", () => {
  it("wraps success and errors", async () => {
    expect(await toResult(async () => 3)).toEqual({ ok: true, data: 3 });
    expect(await toResult(async () => Promise.reject(new Error("Nope")))).toEqual({
      ok: false,
      error: "Nope",
    });
  });

  it("names the field for validation errors", async () => {
    const r = await toResult(async () => z.object({ town: z.string().min(1) }).parse({ town: "" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/^Check town:/);
  });
});
