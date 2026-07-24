import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function resetDemo(request: APIRequestContext) {
  const response = await request.post("/api/demo/reset", {
    data: { token: process.env.DEMO_RESET_TOKEN },
  });
  const body = await response.text();
  expect(response.status(), body).toBe(200);
}

export async function uploadCsv(
  request: APIRequestContext,
  csv: string,
  options: {
    filename?: string;
    preview?: boolean;
    signedAmountConvention?: "negative_expense" | "positive_expense";
    columnMapping?: Record<string, string | null>;
    mimeType?: string;
  } = {},
) {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    file: {
      name: options.filename ?? "qa-transactions.csv",
      mimeType: options.mimeType ?? "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    },
    signedAmountConvention: options.signedAmountConvention ?? "negative_expense",
  };
  if (options.preview) multipart.preview = "true";
  if (options.columnMapping) multipart.columnMapping = JSON.stringify(options.columnMapping);
  return request.post("/api/upload", { multipart });
}

export async function uploadCsvInUi(page: Page, csv: string, filename = "qa-transactions.csv") {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
}

export async function navigateTo(page: Page, label: string) {
  const desktopLink = page.locator("aside").getByRole("link", { name: label, exact: true });
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
    return;
  }

  const menu = page.getByRole("button", { name: /open navigation/i });
  if (await menu.isVisible()) await menu.click();
  await page.locator("header").getByRole("link", { name: label, exact: true }).click();
}
