import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer:
    process.env.DATABASE_URL && process.env.DEMO_RESET_TOKEN
      ? {
          command: "npm run dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        }
      : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
