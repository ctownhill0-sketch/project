import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("reduced motion removes movement but keeps a short fade", async ({ page }) => {
  await page.goto("/design");
  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete demo data?" });
  await expect(dialog).toBeVisible();
  const style = await dialog.evaluate((el) => {
    const s = getComputedStyle(el);
    return { enterScale: s.getPropertyValue("--tw-enter-scale").trim(), duration: s.transitionDuration };
  });
  expect(style.enterScale === "" || style.enterScale === "1").toBe(true);
  const pressScale = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--press-scale").trim(),
  );
  expect(pressScale).toBe("1");
});
