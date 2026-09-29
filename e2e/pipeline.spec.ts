import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe.configure({ mode: "serial" });

test.describe("Pipeline", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "flows run once, at desktop width");
  });

  test("Move to… moves a deal and records history; Lost needs a reason", async ({ page }) => {
    await page.goto("/pipeline");
    const board = page.getByRole("region", { name: "Pipeline board" });
    const card = board.getByRole("listitem").first();
    const name = (await card.getAttribute("aria-label"))!;
    await card.getByRole("button", { name: /^Move to…/ }).click();
    await page.getByRole("menuitem", { name: "Pilot proposed" }).click();
    await expect(page.getByText(`${name} moved to Pilot proposed`)).toBeVisible();
    const moved = board.getByRole("region", { name: /^Pilot proposed, / }).getByRole("listitem", { name });
    await expect(moved).toBeVisible();
    await moved.getByText("History").click();
    await expect(moved).toContainText("→ Pilot proposed");

    await moved.getByRole("button", { name: /^Move to…/ }).click();
    await page.getByRole("menuitem", { name: "Lost" }).click();
    const dialog = page.getByRole("dialog", { name: `Why was ${name} lost?` });
    await expect(dialog.getByRole("button", { name: "Mark lost" })).toBeDisabled();
    expect(await axeViolations(page)).toEqual([]);
    await dialog.getByLabel("Lost reason").fill("Chose to hire an extra leasing agent");
    await dialog.getByRole("button", { name: "Mark lost" }).click();
    await expect(
      board.getByRole("region", { name: /^Lost, / }).getByRole("listitem", { name }),
    ).toContainText("Chose to hire");
  });

  test("drag a card to another column", async ({ page }) => {
    await page.goto("/pipeline");
    const board = page.getByRole("region", { name: "Pipeline board" });
    const card = board
      .getByRole("region", { name: /^(New|Called|Conversation), [1-9]/ })
      .first()
      .getByRole("listitem")
      .first();
    const name = (await card.getAttribute("aria-label"))!;
    // Native drag events with one shared DataTransfer (Playwright's mouse-driven HTML5 drag is unreliable
    // inside a scrolled container); this exercises the app's own dragstart/dragover/drop handlers.
    const target = board.getByRole("region", { name: /^Audit sent, / });
    const data = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer: data });
    await target.dispatchEvent("dragover", { dataTransfer: data });
    await target.dispatchEvent("drop", { dataTransfer: data });
    await expect(page.getByText(`${name} moved to Audit sent`)).toBeVisible();
  });

  test("table view lists deals with a Move to… menu", async ({ page }) => {
    await page.goto("/pipeline?view=table");
    const table = page.getByRole("region", { name: "Pipeline table" });
    await expect(table.getByRole("row")).not.toHaveCount(1);
    await expect(table.getByRole("button", { name: /^Move to…/ }).first()).toBeVisible();
  });
});

test.describe("Pipeline page", () => {
  for (const path of ["/pipeline", "/pipeline?view=table"]) {
    test(`${path} has no axe violations and no sideways scroll in either theme`, async ({ page }) => {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, scheme).toBeLessThanOrEqual(0);
        expect(await axeViolations(page), `${path} ${scheme}`).toEqual([]);
      }
    });
  }
});
