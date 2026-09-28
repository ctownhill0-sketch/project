import { expect, test } from "@playwright/test";
import { NAV_ITEMS } from "../components/shell/nav-items";
import { axeViolations } from "./axe";

const PLACEHOLDERS = NAV_ITEMS.filter((item) => item.href !== "/design");

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
