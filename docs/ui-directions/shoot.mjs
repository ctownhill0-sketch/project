// Screenshots each mock at 1440×900, light mode.
import { chromium } from "@playwright/test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
for (const file of readdirSync(here).filter((f) => f.endsWith(".html"))) {
  await page.goto(pathToFileURL(path.join(here, file)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, file.replace(".html", ".png")) });
}
await browser.close();
console.log("Screenshots written.");
