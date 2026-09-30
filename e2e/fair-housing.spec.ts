import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("Fair-housing check", () => {
  test("page has no axe violations and no sideways scroll in either theme", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/settings/fair-housing");
      await expect(page.getByRole("heading", { level: 1, name: "Fair-housing check" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, scheme).toBeLessThanOrEqual(0);
      expect(await axeViolations(page), scheme).toEqual([]);
    }
  });

  test("tester: pass, block, and a warning overridden with a reason, all logged", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/settings/fair-housing");
    const tester = page.getByRole("region", { name: "Check a text" });
    const box = tester.getByLabel("Text to check");
    const run = tester.getByRole("button", { name: "Check text" });

    await box.fill("Sunny two-bedroom with a family room.");
    await run.click();
    await expect(tester.getByText("No flagged phrases.")).toBeVisible();
    await expect(tester.getByText("Screening aid, not legal advice.")).toBeVisible();

    await box.fill("Lovely unit. No CityFHEPS.");
    await run.click();
    await expect(tester.getByText("Change the wording before this is used.")).toBeVisible();
    await expect(tester.getByText("Source of income · Blocks")).toBeVisible();
    await expect(tester.getByRole("button", { name: /Override/ })).toHaveCount(0);

    await box.fill("Ideal for young professionals.");
    await run.click();
    await tester.getByLabel(/Reason for overriding/).fill("Quoting the firm's own ad back to them.");
    await tester.getByRole("button", { name: "Override with this reason" }).click();
    await expect(tester.getByText("Overridden: Quoting the firm's own ad back to them.")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await page.reload();
    const log = page.getByRole("region", { name: "Check log table" });
    await expect(log).toContainText("Quoting the firm's own ad");
  });

  test("a script with blocked wording can't be saved", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/settings/fair-housing");
    const scripts = page.getByRole("region", { name: "Call scripts" });
    await scripts.getByRole("button", { name: "Edit Voicemail" }).click();
    const body = scripts.getByLabel("Voicemail wording");
    await body.fill("Hi {{contactName}}, we take no vouchers.");
    await scripts.getByRole("button", { name: "Check and save" }).click();
    await expect(scripts.getByText("Change the wording before this is used.")).toBeVisible();
    await body.fill("Hi {{contactName}}, following up on the reply-time test.");
    await scripts.getByRole("button", { name: "Check and save" }).click();
    await expect(page.getByText("Voicemail saved")).toBeVisible();
  });

  test("a rule with a broken pattern is refused with a clear message", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/settings/fair-housing");
    const form = page.getByRole("form", { name: "Add a rule" });
    await form.getByLabel(/^Pattern/).fill("(no students");
    await form.getByLabel("Why it's a problem").fill("Local ordinance.");
    await form.getByRole("button", { name: "Add rule" }).click();
    await expect(form.getByText(/isn't a valid pattern/)).toBeVisible();
    await form.getByLabel(/^Pattern/).fill(String.raw`\bno students\b`);
    await form.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByText("Rule added")).toBeVisible();
    await expect(page.getByRole("list", { name: "Fair-housing rules" })).toContainText(
      String.raw`\bno students\b`,
    );
  });
});
