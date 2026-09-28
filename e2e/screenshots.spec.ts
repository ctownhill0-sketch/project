import { test } from "@playwright/test";

// Checkpoint screenshots. Run on demand: SHOTS=1 pnpm e2e e2e/screenshots.spec.ts
test.skip(!process.env.SHOTS, "set SHOTS=1 to capture checkpoint screenshots");

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "leads", path: "/leads" },
];

for (const scheme of ["light", "dark"] as const) {
  for (const target of PAGES) {
    test(`${target.name} ${scheme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(target.path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForLoadState("networkidle");
      const width = info.project.name.split("-").at(-1);
      // Window-sized shots: a full-page capture paints fixed bars (phone tab bar, sidebar) mid-page.
      await page.screenshot({ path: `docs/checkpoints/s/${target.name}-${width}-${scheme}.png` });
      if (width === "320") {
        const main =
          target.name === "leads"
            ? page.getByRole("grid", { name: "Leads" })
            : page.getByRole("heading", { level: 2, name: "Today" });
        await main.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `docs/checkpoints/s/${target.name}-${width}-${scheme}-scrolled.png` });
      }
    });
  }
}
