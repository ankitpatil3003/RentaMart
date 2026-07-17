import { defineConfig, devices } from "@playwright/test";

const trustEnabled = process.env.E2E_TRUST === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: trustEnabled
    ? [
        {
          name: "clerk-setup",
          testMatch: /clerk\.setup\.ts/,
        },
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: /clerk\.setup\.ts/,
          dependencies: ["clerk-setup"],
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: /clerk\.setup\.ts/,
        },
      ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev:web",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
