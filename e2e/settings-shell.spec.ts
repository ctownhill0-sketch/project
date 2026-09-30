import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("Settings", () => {
  test("page: axe clean and no sideways scroll in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/settings");
      await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });

  test("weights rescore, weekly numbers save, thresholds validate", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/settings");
    await page
      .getByRole("form", { name: "Scoring weights" })
      .getByRole("button", { name: "Save weights and rescore" })
      .click();
    await expect(page.getByText(/^Weights saved\. \d+ leads rescored\.$/)).toBeVisible();

    const week = page.getByRole("form", { name: "This week's numbers" });
    await week.getByLabel("Week of").fill("2027-02-03");
    await week.getByLabel("MRR ($)").fill("1200");
    await week.getByLabel("Paying clients").fill("3");
    await week.getByRole("button", { name: "Save week" }).click();
    await expect(page.getByText("Week saved")).toBeVisible();
    await expect(page.getByRole("list", { name: "Recent weeks" })).toContainText("Week of 2027-02-01");

    const t = page.getByRole("form", { name: "Thresholds" });
    await t.getByLabel("At risk from day").fill("20");
    await t.getByRole("button", { name: "Save thresholds" }).click();
    await expect(t.getByRole("alert")).toContainText("At risk must start before the pilot ends.");
  });

  test("data export and backup download; demo delete needs the phrase", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    const json = await page.request.get("/settings/export");
    expect(json.status()).toBe(200);
    const body = (await json.json()) as { format: string; tables: Record<string, unknown[]> };
    expect(body.format).toBe("vacancy-desk-export");
    expect(body.tables.company!.length).toBeGreaterThan(0);
    const backup = await page.request.get("/settings/backup");
    expect(backup.status()).toBe(200);
    expect(backup.headers()["content-type"]).toBe("application/gzip");

    await page.goto("/settings#data");
    const del = page.getByRole("form", { name: "Delete demo data" });
    await expect(del.getByRole("button", { name: "Delete demo data" })).toBeDisabled();
    await del.getByLabel("Type DELETE DEMO DATA to confirm").fill("DELETE DEMO");
    await expect(del.getByRole("button", { name: "Delete demo data" })).toBeDisabled();
  });
});

test.describe("Shell", () => {
  test("? opens the grouped shortcut sheet; ⌘K runs actions; the bell lists pilots at risk", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/dashboard");
    await expect(page.getByText("Getting started")).toBeVisible();
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet.getByRole("table", { name: "Call workspace" })).toContainText("Leave call-block mode");
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("dialog", { name: "Command menu" }).getByRole("combobox").fill("Present ROI");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/roi\?present=1$/);

    await page
      .getByRole("button", { name: /^Notifications/ })
      .first()
      .click();
    await expect(page.getByText(/Pilot at risk on day \d+/).first()).toBeVisible();
  });
});
