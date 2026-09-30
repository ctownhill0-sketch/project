import { expect, test } from "@playwright/test";
import { NAV_ITEMS } from "../components/shell/nav-items";
import { axeViolations } from "./axe";

// Pages that are built have their own specs (dashboard, leads, design).
const BUILT = new Set([
  "/design",
  "/dashboard",
  "/leads",
  "/finder",
  "/settings",
  "/shops",
  "/calls",
  "/pipeline",
  "/roi",
  "/audits",
  "/pilots",
]);
const PLACEHOLDERS = NAV_ITEMS.filter((item) => !BUILT.has(item.href));

test("the home page redirects to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const item of PLACEHOLDERS) {
  test(`${item.label} has a heading, an honest empty state and one action`, async ({ page }) => {
    const response = await page.goto(item.href);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: item.label })).toBeVisible();
    await expect(page).toHaveTitle(`${item.label} | Vacancy Desk`);
    const main = page.locator("main");
    await expect(main.getByText(`Built in step ${item.step} of the Free Build.`)).toBeVisible();
    await expect(main.getByRole("link")).toHaveCount(1);
    expect(await axeViolations(page)).toEqual([]);
  });
}

const EVERY_PAGE = [
  "/dashboard",
  "/leads",
  "/leads/import",
  "/leads/duplicates",
  "/leads/review",
  "/finder",
  "/finder/results",
  "/finder/triage",
  "/finder/usage",
  "/shops",
  "/shops/plan",
  "/calls",
  "/calls?mode=block",
  "/pipeline",
  "/pipeline?view=table",
  "/roi",
  "/roi?present=1",
  "/audits",
  "/pilots",
  "/settings",
  "/settings/fair-housing",
  "/design",
];

test("every page and mode has exactly one h1", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1440", "structure is the same at every width");
  test.setTimeout(120_000);
  for (const path of EVERY_PAGE) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("h1"), path).toHaveCount(1);
  }
});
