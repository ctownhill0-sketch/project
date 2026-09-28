import { describe, expect, it } from "vitest";
import { formatPhone, telHref } from "@/lib/format";

describe("formatPhone", () => {
  it("formats US numbers for reading", () => {
    expect(formatPhone("+19175550125")).toBe("(917) 555-0125");
    expect(formatPhone("917-555-0125")).toBe("(917) 555-0125");
    expect(formatPhone("19175550125")).toBe("(917) 555-0125");
  });
  it("leaves anything else as typed", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
});

describe("telHref", () => {
  it("builds a tel: link from digits only", () => {
    expect(telHref("(917) 555-0125")).toBe("tel:+19175550125");
    expect(telHref("+19175550125")).toBe("tel:+19175550125");
  });
});
