import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const databaseUrl = process.env.DATABASE_URL;
const resetToken = process.env.DEMO_RESET_TOKEN;
const isLocalDatabase = /(?:127\.0\.0\.1|localhost)/.test(databaseUrl ?? "");
const firefoxEnabled =
  process.platform !== "win32" || process.env.PLAYWRIGHT_FORCE_FIREFOX === "true";

if (!databaseUrl || !resetToken) {
  throw new Error("Playwright requires explicit DATABASE_URL and DEMO_RESET_TOKEN values.");
}
if (!isLocalDatabase && process.env.ALLOW_REMOTE_E2E_DATABASE !== "true") {
  throw new Error(
    "Refusing to run Playwright against a remote database without ALLOW_REMOTE_E2E_DATABASE=true.",
  );
}
if (!firefoxEnabled) {
  console.warn(
    "Firefox is excluded on Windows because its Playwright Juggler process cannot initialize on this host. Linux CI still runs the Firefox project.",
  );
}

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/playwright-results.json" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: /api-security\.spec\.ts/,
    },
    {
      name: "chromium",
      testMatch: /(csv-imports|feature-flows)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "chromium-mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    ...(firefoxEnabled
      ? [{
          name: "firefox",
          testMatch: /browser-smoke\.spec\.ts/,
          use: {
            ...devices["Desktop Firefox"],
            viewport: { width: 1366, height: 768 },
          },
        }]
      : []),
    {
      name: "webkit",
      testMatch: /browser-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
});
