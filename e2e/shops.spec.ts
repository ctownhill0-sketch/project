import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

test.describe("Mystery shops", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "flows run once, at desktop width");
  });

  test("plan → log a shop for a firm → it shows as shopped; a second shop within 30 days is refused", async ({
    page,
  }) => {
    await page.goto("/shops/plan");
    const open = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: /^Log shop/ }) })
      .first();
    const name = (await open.locator("span.font-medium").innerText()).trim();
    await open.getByRole("link", { name: /^Log shop/ }).click();
    const form = page.getByRole("complementary", { name: "Log a shop" });
    await expect(form).toContainText(name);
    await form.getByRole("button", { name: "Website form" }).click();
    await form.getByRole("button", { name: "Log shop" }).click();
    await expect(page.getByText(/^Shop logged \(/)).toBeVisible();

    await page.goto("/shops/plan");
    await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("Shopped");

    await page.goto("/shops");
    await page.getByLabel("Firm").fill(name.split(" ")[0]!);
    await page
      .getByRole("list", { name: "Matching firms" })
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
    await page
      .getByRole("complementary", { name: "Log a shop" })
      .getByRole("button", { name: "Log shop" })
      .click();
    await expect(page.getByText(/One shop per firm per 30 days/)).toBeVisible();
  });

  test("a shop sent 2 hours ago shows a reply check; Replied now clears it", async ({ page }) => {
    await page.goto("/shops/plan");
    const open = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: /^Log shop/ }) })
      .first();
    const name = (await open.locator("span.font-medium").innerText()).trim();
    await open.getByRole("link", { name: /^Log shop/ }).click();
    const form = page.getByRole("complementary", { name: "Log a shop" });
    await form.getByLabel("Earlier").check();
    // datetime-local wants the browser's local wall time.
    const twoHoursAgo = await page.evaluate(() => {
      const d = new Date(Date.now() - 2 * 3600_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    await form.getByLabel("Sent at").fill(twoHoursAgo);
    await form.getByRole("button", { name: "Log shop" }).click();
    await expect(page.getByText(/^Shop logged \(/)).toBeVisible();

    const check = page
      .getByRole("region", { name: "Reply checks due" })
      .getByRole("listitem")
      .filter({ hasText: name });
    await expect(check).toContainText("1h check");
    await check.getByLabel(`Reply type for ${name}`).selectOption("auto");
    await check.getByRole("button", { name: `Replied now: ${name}` }).click();
    await expect(page.getByText(`Reply from ${name} recorded`)).toBeVisible();
    await expect(check).toHaveCount(0);
    await expect(page.getByRole("region", { name: "All shops table" })).toContainText("Auto-reply");
  });
});

test.describe("Mystery shop pages", () => {
  for (const path of ["/shops", "/shops/plan"]) {
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
