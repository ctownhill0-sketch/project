import { defineConfig, devices } from "@playwright/test";

// On a Mac: `pnpm exec playwright install chromium` once. In a container with a
// pre-installed browser, set PW_CHROMIUM_PATH to reuse it instead of downloading.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    {
      name: "phone-320",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 640 }, hasTouch: true },
    },
  ],
  // Its own port and database folder, reset on every run, with recorded Google responses and
  // fixture websites: e2e never touches the founder's data or the internet, and never spends a
  // real Google request (finder spec §3, D-F7).
  webServer: {
    command: "pnpm db:reset && next dev -H 127.0.0.1 -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PGLITE_DIR: ".data/e2e/pglite", PLACES_TRANSPORT: "fixtures", WEB_TRANSPORT: "fixtures" },
  },
});
