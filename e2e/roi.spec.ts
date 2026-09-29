import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test.describe("ROI calculator", () => {
  test("defaults show $59.18 a vacant day, inputs update the link, present mode", async ({ page }, info) => {
    await page.goto("/roi");
    await expect(page.getByRole("heading", { level: 1, name: "ROI calculator" })).toBeVisible();
    await expect(page.getByText("$59.18")).toBeVisible();
    expect(await axeViolations(page), info.project.name).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");

    await page.getByLabel("Monthly rent").fill("2400");
    await expect(page).toHaveURL(/rent=2400/);
    await expect(page.getByText("$78.90")).toBeVisible();

    await page.getByRole("link", { name: "Present" }).click();
    await expect(page.getByText("What vacancy costs you")).toBeVisible();
    await expect(page.getByText("$78.90")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Exit present mode" }).click();
    await expect(page.getByLabel("Monthly rent")).toHaveValue("2400");
  });

  test("a shared link restores the inputs; bad values fall back to defaults", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/roi?rent=abc&turnoversPerYear=10");
    await expect(page.getByLabel("Monthly rent")).toHaveValue("1800");
    await expect(page.getByLabel("Turnovers a year")).toHaveValue("10");
  });

  test("save a scenario for a lead", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "flow runs once, at desktop width");
    await page.goto("/leads");
    const grid = page.getByRole("grid", { name: "Leads" });
    await grid.getByRole("row").nth(1).getByRole("gridcell").nth(1).click();
    await expect(page).toHaveURL(/[?&]lead=/);
    const leadId = new URL(page.url()).searchParams.get("lead");
    expect(leadId).toBeTruthy();
    await page.goto(`/roi?lead=${leadId}`);
    const save = page.getByRole("button", { name: /^Save for / });
    await save.click();
    await expect(page.getByText(/^Saved for .*Call prep will quote it\.$/)).toBeVisible();
  });
});
