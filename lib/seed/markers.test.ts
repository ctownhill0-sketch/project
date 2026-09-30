import { describe, expect, it } from "vitest";
import { isDemoFirm } from "@/lib/seed/markers";

describe("isDemoFirm", () => {
  it("is true only for reserved .example domains or 555-01xx phones", () => {
    expect(isDemoFirm({ normalizedDomain: "harborline.example", normalizedPhone: null })).toBe(true);
    expect(isDemoFirm({ normalizedDomain: null, normalizedPhone: "+12015550142" })).toBe(true);
    expect(isDemoFirm({ normalizedDomain: "harborline.com", normalizedPhone: "+12015551234" })).toBe(false);
    expect(isDemoFirm({ normalizedDomain: "example.com", normalizedPhone: "+15550100123" })).toBe(false);
    expect(isDemoFirm({ normalizedDomain: null, normalizedPhone: null })).toBe(false);
  });
});
