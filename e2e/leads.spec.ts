import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("Leads", () => {
  test("header, grid and detail with no axe violations in either theme", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/leads");
      await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
      await expect(page.getByRole("group", { name: "Key numbers" })).toContainText("Possible duplicates");
      await expect(page.getByRole("grid", { name: "Leads" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Find leads" })).toHaveAttribute("href", "/finder");
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });

  test("filter chips narrow the list and live in the URL", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("link", { name: "Excluded", exact: true }).click();
    await expect(page).toHaveURL(/status=excluded/);
    await expect(page.getByText(/Showing 5 of 50/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Excluded", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/leads$/);
  });
});

test.describe("Leads split view", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "side-by-side split is ≥1280px");
  });

  test("J/K move the selection, the URL and the detail panel", async ({ page }) => {
    await page.goto("/leads");
    const grid = page.getByRole("grid", { name: "Leads" });
    const first = await grid.getByRole("row", { selected: true }).getByRole("gridcell").first().innerText();
    await page.locator("main h1").click();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/lead=/);
    const second = grid.getByRole("row", { selected: true }).getByRole("gridcell").first();
    await expect(second).not.toHaveText(first);
    const name = await second.innerText();
    await expect(page.getByRole("region", { name: `Lead: ${name}` })).toBeVisible();
    await page.keyboard.press("k");
    await expect(grid.getByRole("row", { selected: true }).getByRole("gridcell").first()).toHaveText(first);
  });

  test("a linked record opens directly", async ({ page }) => {
    await page.goto("/leads?status=excluded");
    const row = page.getByRole("grid").getByRole("row").nth(2);
    const name = await row.getByRole("gridcell").first().innerText();
    await row.click();
    await expect(page).toHaveURL(/status=excluded&lead=/);
    const url = page.url();
    await page.goto(url);
    await expect(page.getByRole("region", { name: `Lead: ${name}` })).toBeVisible();
  });
});

test.describe("Leads below 1280px", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === "desktop-1440", "the sheet appears below 1280px");
  });

  test("a row opens the detail as a sheet, Escape closes it", async ({ page }) => {
    await page.goto("/leads");
    const row = page.getByRole("grid").getByRole("row").nth(1);
    const name = await row.getByRole("gridcell").first().innerText();
    await row.click();
    const sheet = page.getByRole("dialog", { name: `Lead: ${name}` });
    await expect(sheet).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/lead=/);
  });
});
