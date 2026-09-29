import { expect, test, type Page } from "@playwright/test";
import { axeViolations } from "./axe";

// Runs against recorded Google responses and fixture websites (PLACES_TRANSPORT/WEB_TRANSPORT=fixtures).
test.describe.configure({ mode: "serial" });

const heading = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 }).first();

test.describe("Lead finder demo", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "the full flow runs once, at desktop width");
  });

  test("search a 2-town territory, check websites, triage 10 by keyboard with undo, leads land in Leads", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/finder");
    await expect(page.getByRole("heading", { level: 1, name: "Lead finder" })).toBeVisible();

    // Territory with two fixture towns.
    await page.getByText("New territory").click();
    await page.getByLabel("Territory name").fill("Hudson demo");
    await page.getByLabel("Towns, one per line").fill("Hoboken, NJ\nJersey City, NJ");
    await page.getByRole("button", { name: "Save territory" }).click();
    await expect(page.getByRole("table", { name: "Hudson demo" })).toBeVisible();

    await page.getByRole("tab", { name: "Territory" }).click();
    await expect(page.getByText(/10 searches, up to 30 Google requests/)).toBeVisible();
    await page.getByRole("button", { name: "Run my territory" }).click();
    await expect(page.getByText("Search finished", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("status").getByText(/67 new\)/)).toBeVisible();

    await page.getByRole("button", { name: "Check websites" }).click();
    await expect(page.getByRole("status").getByText(/^Checked \d+ websites$/)).toBeVisible({
      timeout: 60_000,
    });

    // The tracker shows both towns as searched.
    await expect(
      page.getByRole("table", { name: "Hudson demo" }).getByRole("row", { name: /Hoboken, NJ/ }),
    ).not.toContainText("Never");

    await page.getByRole("link", { name: "Start triage" }).click();
    await expect(page).toHaveURL(/\/finder\/triage\?run=/);
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();

    const added: string[] = [];
    // Names can repeat across towns, so wait for the place ID to change, and return the name.
    const placeId = () => page.locator("[data-place-id]").getAttribute("data-place-id");
    const press = async (key: string) => {
      const [id, name] = [await placeId(), (await heading(page).innerText()).trim()];
      await page.keyboard.press(key);
      await expect(page.locator("[data-place-id]")).not.toHaveAttribute("data-place-id", id!);
      return name;
    };

    added.push(await press("a"));
    added.push(await press("a"));
    await press("s");
    await press("n");
    const undone = await press("a");
    // U brings the last one back and removes the lead it created.
    await page.keyboard.press("u");
    await expect(heading(page)).toHaveText(undone);
    await expect(page.locator("[data-place-id]")).toBeVisible();
    added.push(await press("a"));
    // D needs a second press, and can't be undone.
    await page.keyboard.press("d");
    await expect(page.getByRole("alert").filter({ hasText: "permanent" })).toBeVisible();
    await press("d");
    await page.keyboard.press("u");
    await expect(page.getByText("Do-not-call is permanent and can't be undone.")).toBeVisible();
    added.push(await press("a"));
    await press("s");
    added.push(await press("a"));
    await press("n");
    // 10 decisions kept (the undone add doesn't count): the next place is number 11.
    await expect(page.getByText(/^11 of \d+$/)).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);

    // Hand-off: the added firms are New leads with a why line.
    await page.goto("/leads?status=new");
    const grid = page.getByRole("grid", { name: "Leads" });
    for (const name of added) await expect(grid.getByRole("gridcell", { name, exact: true })).toBeVisible();
    await grid.getByRole("gridcell", { name: added[0]!, exact: true }).click();
    const panel = page.getByRole("region", { name: `Lead: ${added[0]}` });
    await expect(panel.getByRole("heading", { name: "Why this lead" })).toBeVisible();
    await expect(panel).toContainText(/units|listings|not shopped yet/);
  });
});

test.describe("Lead finder pages", () => {
  for (const path of ["/finder", "/finder/results", "/finder/triage", "/finder/usage"]) {
    test(`${path} has no axe violations in either theme`, async ({ page }) => {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} ${scheme} scrolls sideways`).toBeLessThanOrEqual(0);
        expect(await axeViolations(page), `${path} ${scheme}`).toEqual([]);
      }
    });
  }
});

test.describe("Settings > Google Places", () => {
  test("shows key status without the key, tests it, and saves caps", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "form flow checked once");
    await page.goto("/settings#places");
    const section = page.getByRole("region", { name: "Google Places" });
    await expect(section).toContainText("Demo mode: recorded Google responses");
    await expect(section).toContainText("Restrict the key");
    await expect(section).toContainText("$1 budget alert");
    await section.getByRole("button", { name: "Test key" }).click();
    await expect(page.getByText("Google accepted the key.")).toBeVisible();
    await section.getByLabel("Per day").first().fill("80");
    await section.getByRole("button", { name: "Save caps" }).click();
    await expect(page.getByText("Caps saved")).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Google Places" }).getByLabel("Per day").first(),
    ).toHaveValue("80");
    expect(await axeViolations(page)).toEqual([]);
  });
});
