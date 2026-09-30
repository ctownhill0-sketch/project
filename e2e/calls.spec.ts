import { expect, test, type Page } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

const current = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 }).first();

test.describe("Call workspace", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "flows run once, at desktop width");
  });

  test("hotkey 1 logs No answer, suggests a next step and moves to the next firm", async ({ page }) => {
    await page.goto("/calls");
    const list = page.getByRole("listbox", { name: "Call list" });
    await expect(list).toBeVisible();
    const name = (await current(page).innerText()).trim();
    await expect(page.getByRole("link", { name: /^Call \(\d{3}\) \d{3}-\d{4}$/ })).toHaveAttribute(
      "href",
      /^tel:\+1\d{10}$/,
    );
    expect(await axeViolations(page)).toEqual([]);
    await page.locator("main h1").click();
    await page.keyboard.press("1");
    await expect(page.getByText(new RegExp(`^${name}: No answer\\. Next step`))).toBeVisible();
    await expect(current(page)).not.toHaveText(name);
    await expect(list.getByRole("option", { name: new RegExp(name) })).toHaveCount(0);
  });

  test("call block mode loads the next firm after each call; Esc exits", async ({ page }) => {
    await page.goto("/calls?mode=block");
    await expect(page.getByRole("heading", { level: 1, name: "Call block" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Call block\s*call 1 of \d+/ })).toBeVisible();
    const first = (await current(page).innerText()).trim();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await page.keyboard.press("5");
    await expect(page.getByText(new RegExp(`^${first}: Conversation`))).toBeVisible();
    await expect(current(page)).not.toHaveText(first);
    await expect(page).toHaveURL(/mode=block&lead=/);
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/calls$/);
  });

  test("9 twice marks do not call, permanently", async ({ page }) => {
    await page.goto("/calls");
    const name = (await current(page).innerText()).trim();
    const url = page.url();
    await page.locator("main h1").click();
    await page.keyboard.press("9");
    await expect(page.getByRole("alert").filter({ hasText: "permanent" })).toBeVisible();
    await page.keyboard.press("9");
    await expect(page.getByText(new RegExp(`^${name}: Do not call`))).toBeVisible();
    expect(url).toContain("/calls");
    await page.goto("/leads?q=" + encodeURIComponent(name));
    await expect(page.getByRole("region", { name: `Lead: ${name}` })).toContainText("Do not call");
  });
});

test.describe("Calls page", () => {
  test("has no axe violations and no sideways scroll in either theme", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/calls");
      await expect(page.getByRole("heading", { level: 1, name: "Calls" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });
});
