import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/**/*.spec.mjs", "apps/*/tests/**/*.spec.mjs"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    ...devices["Pixel 7"],
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Use an installed Chrome instead of the bundled browser, e.g. CHROME_PATH=/usr/bin/google-chrome
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
