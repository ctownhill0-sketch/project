import { describe, expect, it } from "vitest";
import { leadsHref, parseLeadFilters } from "@/lib/queries/lead-filters";

describe("parseLeadFilters", () => {
  it("keeps valid status, software and a trimmed search", () => {
    expect(parseLeadFilters({ status: "ready", software: "buildium", q: "  harbor " })).toEqual({
      status: "ready",
      software: "buildium",
      q: "harbor",
    });
  });

  it("drops unknown values, arrays, empty and over-long searches", () => {
    expect(parseLeadFilters({ status: "vip", software: ["yardi", "none"], q: "" })).toEqual({});
    expect(parseLeadFilters({ q: "x".repeat(101) })).toEqual({});
  });
});

describe("leadsHref", () => {
  it("builds a /leads URL from filters, with a patch and a trailing record param", () => {
    expect(leadsHref({ status: "ready" })).toBe("/leads?status=ready");
    expect(leadsHref({ status: "ready" }, { software: "yardi" })).toBe("/leads?status=ready&software=yardi");
    expect(leadsHref({ status: "ready", q: "a b" }, { status: undefined })).toBe("/leads?q=a+b");
    expect(leadsHref({}, {}, true)).toBe("/leads?lead=");
    expect(leadsHref({ status: "new" }, {}, true)).toBe("/leads?status=new&lead=");
  });
});
