import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("app shell", () => {
  test("skip link is the first Tab stop and moves focus to main", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("shows the right navigation for the screen width", async ({ page }, info) => {
    await page.goto("/dashboard");
    const sidebar = page.getByRole("navigation", { name: "Main" });
    if (info.project.name === "desktop-1440") {
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    } else if (info.project.name === "tablet-768") {
      await expect(sidebar).toBeHidden();
      await page.getByRole("button", { name: "Menu" }).click();
      const drawer = page.getByRole("dialog", { name: "Menu" });
      await expect(drawer).toBeVisible();
      // Focus is trapped inside the drawer.
      for (let i = 0; i < 15; i += 1) await page.keyboard.press("Tab");
      await expect(drawer.locator(":focus")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    } else {
      const bar = page.getByRole("navigation", { name: "Quick" });
      await expect(bar).toBeVisible();
      for (const link of await bar.getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await bar.getByRole("button", { name: "Menu" }).click();
      await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    }
  });

  test("never scrolls sideways and has no axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);
  });
});
