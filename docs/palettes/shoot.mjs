// Screenshots Checkpoint P pages: swatch sheets (full page) and mocks at 1440×900.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "mocks"),
  shots = path.join(here, "shots");
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  const dark = file.includes("-dark");
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: dark ? "dark" : "light",
  });
  await page.goto(pathToFileURL(path.join(dir, file)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(shots, file.replace(".html", ".png")),
    fullPage: file.startsWith("swatches"),
  });
  await page.close();
}
await browser.close();
console.log("Shots written.");
