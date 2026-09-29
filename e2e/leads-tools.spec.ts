import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

test.describe("Leads tools", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "flows run once, at desktop width");
  });

  test("import a CSV: map, preview, import; duplicates and do-not-call are skipped", async ({ page }) => {
    await page.goto("/leads/import");
    await page.getByLabel("CSV file (up to 5,000 rows)").setInputFiles("public/sample-leads.csv");
    await expect(page.getByRole("heading", { name: "3. Check the first 20 rows" })).toBeVisible();
    await expect(page.getByLabel("Company Name")).toHaveValue("name");
    await expect(page.getByRole("region", { name: "Preview rows" })).toContainText(
      "Maplestone Property Management",
    );
    expect(await axeViolations(page)).toEqual([]);
    await page.getByLabel("Save this column match as (optional)").fill("Sample scraper");
    await page.getByRole("button", { name: /^Import \d+ leads$/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /Imported \d+ leads/ })).toBeVisible();

    // Importing the same file again adds nothing: every row is now a duplicate.
    await page.reload();
    await page.getByLabel("CSV file (up to 5,000 rows)").setInputFiles("public/sample-leads.csv");
    await expect(page.getByRole("button", { name: "Import 0 leads" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sample scraper" })).toBeVisible();
  });

  test("merge a pair of possible duplicates", async ({ page }) => {
    await page.goto("/leads/duplicates");
    const pairs = page.getByRole("listitem").filter({ has: page.getByRole("group", { name: /^Merge / }) });
    const before = await pairs.count();
    expect(before).toBeGreaterThan(0);
    expect(await axeViolations(page)).toEqual([]);
    await pairs.first().getByRole("button", { name: "Keep left" }).click();
    await expect(page.getByText(/^Merged into /)).toBeVisible();
    await expect(pairs).toHaveCount(before - 1);
  });

  test("set software from the review queue", async ({ page }) => {
    await page.goto("/leads/review");
    const items = page.getByRole("main").getByRole("listitem");
    const before = await items.count();
    test.skip(before === 0, "seed has nothing to review");
    expect(await axeViolations(page)).toEqual([]);
    await items.first().getByLabel("Software").selectOption("buildium");
    await items.first().getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Software saved")).toBeVisible();
    await expect(items).toHaveCount(before - 1);
  });

  test("save a view, bulk-update status, and export CSV", async ({ page }) => {
    await page.goto("/leads?status=new");
    await page.getByRole("button", { name: "Save this view" }).click();
    await page.getByLabel("View name").fill("Fresh leads");
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(page.getByRole("link", { name: "Fresh leads" })).toHaveAttribute("aria-current", "true");

    const grid = page.getByRole("grid", { name: "Leads" });
    const boxes = grid.getByRole("checkbox", { name: /^Select (?!all)/ });
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    const bar = page.getByRole("toolbar", { name: "Bulk actions" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Researching" }).click();
    await expect(page.getByText(/^Updated 2/)).toBeVisible();

    const href = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    expect(href).toBe("/leads/export?status=new");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect((await res.text()).split("\r\n")[0]).toContain("Why this lead");
  });
});

test.describe("Leads tool pages", () => {
  for (const path of ["/leads/import", "/leads/duplicates", "/leads/review"]) {
    test(`${path} has no axe violations and no sideways scroll in either theme`, async ({ page }) => {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} ${scheme}`).toBeLessThanOrEqual(0);
        expect(await axeViolations(page), `${path} ${scheme}`).toEqual([]);
      }
    });
  }
});
