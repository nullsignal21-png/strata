import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("investor demo flow", () => {
  test.skip(!process.env.DATABASE_URL || !process.env.DEMO_RESET_TOKEN, "requires DATABASE_URL and DEMO_RESET_TOKEN");

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    const input = page.getByPlaceholder("Demo reset token");
    await input.waitFor({ state: "visible" });
    // Retry fill to avoid Next.js hydration clearing the value
    await expect(async () => {
      const tokenToUse = process.env.DEMO_RESET_TOKEN || "f3a4b9c1d8e20796f5b3a4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5";
      await input.clear();
      await input.pressSequentially(tokenToUse);
      await expect(page.getByRole("button", { name: /^Reset$/ })).toBeEnabled({ timeout: 1000 });
    }).toPass();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^Reset$/ }).click();
    await expect(page.getByText(/Demo data reset/)).toBeVisible({ timeout: 120000 });
  });

  test("critical investor demo flow", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /enter demo dashboard/i }).click();
    await expect(page.getByRole("heading", { name: /job profitability dashboard/i })).toBeVisible();
    await expect(page.getByText(/gross profit/i).first()).toBeVisible();

    await page.getByRole("link", { name: /upload/i }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /download sample csv/i }).click();
    await download;
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "public/sample-transactions.csv"));
    const importBtn = page.getByRole("button", { name: /import and categorize|import/i });
    await expect(importBtn).toBeEnabled();
    await importBtn.click();
    await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible();

    await page.getByRole("link", { name: /transactions/i }).click();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator("select").nth(1).selectOption("Fuel & Vehicle");
    await firstRow.locator("select").nth(2).selectOption({ index: 1 });
    await firstRow.getByRole("button", { name: /^Review$/ }).click();
    await expect(page.getByText(/Transaction updated/)).toBeVisible();

    await page.getByRole("link", { name: /jobs/i }).click();
    await page.getByRole("link", { name: /Cary HVAC Replacement/i }).click();
    await expect(page.getByText(/Cash collected/i)).toBeVisible();

    await page.getByRole("link", { name: /reports/i }).click();
    const exportDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: /quickbooks csv/i }).click();
    await exportDownload;

  });
});
