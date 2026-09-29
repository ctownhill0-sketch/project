import { describe, expect, it } from "vitest";
import { fixturePageSource, fixtureSite } from "@/lib/finder/fixture-sites";

describe("fixture sites", () => {
  it("serves a deterministic homepage and rentals page for .example firms", async () => {
    const source = fixturePageSource();
    const url = "https://www.harborline.example/";
    const site = fixtureSite(url);
    const res = await source.get(url);
    if (site) {
      expect(res).toMatchObject({ ok: true });
      expect(res.ok && res.html).toMatch(/We manage over \d+ doors/);
    } else {
      expect(res).toMatchObject({ ok: false });
    }
  });

  it("never serves anything for real domains", async () => {
    expect(fixtureSite("https://www.google.com/")).toBeNull();
    expect(await fixturePageSource().get("https://real-firm.com/")).toMatchObject({ ok: false });
  });
});
