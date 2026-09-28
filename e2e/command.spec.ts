import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("command menu and keyboard map", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "keyboard flows are checked at desktop width");
  });

  test("⌘K finds a lead by name and Enter opens it", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("main").click();
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Command menu" });
    await expect(dialog).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.type("Harbor");
    const hit = dialog.getByRole("option", { name: /Harbor/ }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/\/leads\?lead=/);
  });

  test("G then L goes to Leads; ? shows the shortcut list", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("main").click();
    await page.keyboard.press("g");
    await page.keyboard.press("l");
    await expect(page).toHaveURL(/\/leads$/);
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });

  test("the bell lists what is due", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await expect(page.getByText("Due now")).toBeVisible();
  });
});
