import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

test.describe("Pilot scorecard", () => {
  test("page: axe clean and no sideways scroll in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/pilots");
      await expect(page.getByRole("heading", { level: 1, name: "Pilots" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });

  test("seeded pilots show on track and at risk with icon, label and reasons", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/pilots");
    await expect(page.getByText("Day 7 of 14").first()).toBeVisible();
    const lists = page.getByRole("list", { name: /guarantee by vacancy$/ });
    await expect(lists).toHaveCount(2);
    await expect(page.getByText("On track").first()).toBeVisible();
    await expect(page.getByText("At risk").first()).toBeVisible();
    await expect(page.getByText(/Tours project to 2, under the target of 5\./).first()).toBeVisible();
  });

  test("enter a day with the keyboard and see the scorecard update", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/pilots");
    const form = page.getByRole("form", { name: /^Daily numbers for / }).first();
    const tours = form.getByRole("textbox", { name: /Unit 1A Tours$/ });
    await tours.fill("4");
    await tours.press("ArrowDown");
    await expect(form.getByRole("textbox", { name: /Unit 2A Tours$/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/^Saved \d{4}-\d{2}-\d{2} for /)).toBeVisible();
    await page.reload();
    const card = page.getByRole("list", { name: /guarantee by vacancy$/ }).first();
    await expect(card.getByRole("listitem").first()).toContainText(/Tours\s*\d+ of 5/);
  });

  test("start a pilot", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/pilots");
    const form = page.getByRole("form", { name: "Start a pilot" });
    const firm = await form.getByLabel("Firm").locator("option").nth(3).textContent();
    await form.getByLabel("Firm").selectOption({ index: 3 });
    await form.getByLabel("Vacancy 1 label").fill("Unit 9C");
    await form.getByLabel("Usual days on market (optional)").first().fill("30");
    await form.getByRole("button", { name: "Start pilot" }).click();
    await expect(page.getByText("Pilot started")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: firm!.trim() })).toBeVisible();
    await expect(page.getByText("Day 0 of 14").first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
