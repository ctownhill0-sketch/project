import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

const SECTIONS = ["Design language", "Foundations", "Components", "Six states", "Maintenance"];
const STATES = ["Loading", "Empty", "Error", "Success", "Disabled", "Partial"];

test.describe("/design", () => {
  test("follows the design-system checklist structure", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
    for (const name of SECTIONS) await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    for (const name of STATES) await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
  });

  test("shows every token with its measured contrast", async ({ page }) => {
    await page.goto("/design");
    const colors = page.getByRole("table", { name: "Color tokens" });
    await expect(colors.getByRole("row")).not.toHaveCount(0);
    await expect(colors).toContainText("13.43:1");
    await expect(page.getByRole("table", { name: "Type scale" })).toContainText("48/56");
  });

  test("buttons show loading with a spinner and disabled", async ({ page }) => {
    await page.goto("/design");
    const loading = page.getByRole("button", { name: /Saving/ });
    await expect(loading).toBeDisabled();
    await expect(loading.getByRole("status", { name: "Loading" })).toBeVisible();
  });

  test("the success toast repeats the button's verb", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Save lead" }).click();
    await expect(page.getByText("Lead saved")).toBeVisible();
  });

  test("dialogs have a title and close with Escape", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete demo data?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("has no axe violations in either theme and saves screenshots", async ({ page }, info) => {
    const width = info.project.name.split("-")[1];
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((t) => window.localStorage.setItem("vd-theme", t), theme);
      await page.goto("/design");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await axeViolations(page)).toEqual([]);
      await page.screenshot({ path: `docs/screenshots/design-${width}-${theme}.png`, fullPage: true });
      await page.goto("/dashboard");
      await page.screenshot({ path: `docs/screenshots/shell-${width}-${theme}.png` });
    }
  });
});
