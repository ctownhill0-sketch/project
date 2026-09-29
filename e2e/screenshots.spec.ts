import { expect, test, type Page } from "@playwright/test";

// Screenshots of every page at 1440/768/320 in both themes, on demand:
//   SHOTS=1 pnpm e2e e2e/screenshots.spec.ts --project=desktop-1440
// Output: docs/screenshots/pages/<page>-<width>-<theme>.png (SHOTS_DIR overrides the folder).
test.skip(!process.env.SHOTS, "set SHOTS=1 to capture screenshots");
test.describe.configure({ mode: "serial" });

const DIR = process.env.SHOTS_DIR ?? "docs/screenshots/pages";
const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 320, height: 640 },
];

async function shoot(page: Page, name: string, path: string, prepare?: (page: Page) => Promise<void>) {
  for (const scheme of ["light", "dark"] as const) {
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      if (prepare) await prepare(page);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${DIR}/${name}-${size.width}-${scheme}.png` });
    }
  }
}

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "desktop-1440", "one browser takes every size");
});

test("seed finder data (fixture Google responses)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/finder");
  await page.getByText("New territory").click();
  await page.getByLabel("Territory name").fill("Hudson County");
  await page.getByLabel("Towns, one per line").fill("Hoboken, NJ\nJersey City, NJ");
  await page.getByRole("button", { name: "Save territory" }).click();
  await page.getByRole("tab", { name: "Territory" }).click();
  await page.getByRole("button", { name: "Run my territory" }).click();
  await expect(page.getByText("Search finished", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Check websites" }).click();
  await expect(page.getByRole("status").getByText(/^Checked \d+ websites$/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Start triage" }).click();
  for (const key of ["a", "a", "s", "a"]) {
    const id = await page.locator("[data-place-id]").getAttribute("data-place-id");
    await page.keyboard.press(key);
    await expect(page.locator("[data-place-id]")).not.toHaveAttribute("data-place-id", id!);
  }
});

const PAGES: [string, string][] = [
  ["dashboard", "/dashboard"],
  ["leads", "/leads"],
  ["finder", "/finder"],
  ["finder-results", "/finder/results"],
  ["finder-triage", "/finder/triage"],
  ["finder-usage", "/finder/usage"],
  ["settings", "/settings"],
];

for (const [name, path] of PAGES) {
  test(`screenshots: ${name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await shoot(page, name, path);
  });
}
