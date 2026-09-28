import { test, expect } from "@playwright/test";
import { axeViolations } from "./axe";

test("home has a main landmark and no axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("main#main")).toHaveCount(1);
  expect(await axeViolations(page)).toEqual([]);
});
