import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

const GOOD =
  "Your inquiries waited far longer than renters will. Renters usually lease from whoever answers first. We answer every inquiry in under a minute, day or night.";

test.describe("Vacancy audits", () => {
  test("list page: axe clean, no sideways scroll, both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/audits");
      await expect(page.getByRole("heading", { level: 1, name: "Vacancy audits" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });

  test("start an audit, fix the summary, pass the checks and download the PDF", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/audits");
    await page.getByRole("button", { name: "Start audit" }).click();
    await expect(page).toHaveURL(/\/audits\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("article", { name: "Audit preview" })).toContainText("Response time");
    expect(await axeViolations(page)).toEqual([]);

    const box = page.getByLabel("Summary, in your words");
    await box.fill("You took 999 hours. Too slow.");
    await expect(page.getByText("2 of 3 sentences")).toBeVisible();
    await expect(page.getByText("Not in the audit's data: 999")).toBeVisible();
    await page.getByRole("button", { name: "Check and export PDF" }).click();
    await expect(
      page.getByRole("complementary", { name: "Summary and export" }).getByRole("alert"),
    ).toContainText("Use exactly 3");

    await box.fill(GOOD.replace("far longer", "no vouchers and far longer"));
    await page.getByRole("button", { name: "Check and export PDF" }).click();
    await expect(page.getByText("Change the wording before this is used.")).toBeVisible();
    const blocked = await page.request.get(page.url() + "/pdf");
    expect(blocked.status()).toBe(409);

    await box.fill(GOOD);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Check and export PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^vacancy-audit-.+\.pdf$/);
    const res = await page.request.get(page.url() + "/pdf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.goto("/audits");
    await expect(page.getByRole("region", { name: "All audits" })).toContainText("PDF exported");
  });

  test("detail page: axe clean and no sideways scroll at every width", async ({ page }) => {
    await page.goto("/audits");
    await page.getByRole("button", { name: "Start audit" }).click();
    await expect(page.getByRole("article", { name: "Audit preview" })).toBeVisible();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });
});
