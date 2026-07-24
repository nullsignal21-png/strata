import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { resetDemo, uploadCsv, uploadCsvInUi } from "./helpers";

const prisma = new PrismaClient();

test.describe("CSV preview and import flows", () => {
  test.beforeEach(async ({ request }) => resetDemo(request));
  test.afterEach(async ({ request }) => resetDemo(request));
  test.afterAll(async () => prisma.$disconnect());

  test("standard signed-amount CSV previews without writes and imports exact values", async ({ page }) => {
    const csv = [
      "date,description,merchant,amount",
      "2027-01-02,QA standard expense,QA Supplier,-12.34",
      "2027-01-03,QA standard income,QA Customer,50.00",
    ].join("\n");
    const before = await prisma.transaction.count();

    await uploadCsvInUi(page, csv, "standard-signed.csv");
    await expect(page.getByText("Previewed 2 importable rows from 2 data rows.")).toBeVisible();
    await expect(page.getByText("Income $50.00")).toBeVisible();
    await expect(page.getByText("Expenses $12.34")).toBeVisible();
    expect(await prisma.transaction.count()).toBe(before);

    await page.getByRole("button", { name: "Import and Categorize", exact: true }).click();
    await expect(page.getByText("Imported 2 transactions, skipped 0.")).toBeVisible();
    const rows = await prisma.transaction.findMany({
      where: { description: { startsWith: "QA standard" } },
      orderBy: { date: "asc" },
    });
    expect(rows.map(({ amount, direction }) => [Number(amount), direction])).toEqual([
      [12.34, "expense"],
      [50, "income"],
    ]);
  });

  test("reverse sign convention preserves expense and income direction", async ({ page }) => {
    const csv = [
      "date,description,amount",
      "2027-01-04,QA reverse expense,12.34",
      "2027-01-05,QA reverse income,-50.00",
    ].join("\n");

    await page.goto("/upload");
    await page.getByLabel("Positive values are expenses").check();
    await page.locator('input[type="file"]').setInputFiles({
      name: "reverse.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText("Income $50.00")).toBeVisible();
    await expect(page.getByText("Expenses $12.34")).toBeVisible();
    await page.getByRole("button", { name: "Import and Categorize", exact: true }).click();
    await expect(page.getByText("Imported 2 transactions, skipped 0.")).toBeVisible();

    const rows = await prisma.transaction.findMany({
      where: { description: { startsWith: "QA reverse" } },
      orderBy: { date: "asc" },
    });
    expect(rows.map(({ direction }) => direction)).toEqual(["expense", "income"]);
  });

  test("debit and credit CSV maps and imports both directions", async ({ page }) => {
    const csv = [
      "posted date,details,payee,debit,credit",
      "2027-01-06,QA debit expense,QA Supplier,8.75,",
      "2027-01-07,QA credit income,QA Customer,,25.25",
    ].join("\n");

    await uploadCsvInUi(page, csv, "debit-credit.csv");
    await expect(page.getByText(/debit: debit/)).toBeVisible();
    await expect(page.getByText("Income $25.25")).toBeVisible();
    await expect(page.getByText("Expenses $8.75")).toBeVisible();
    await page.getByRole("button", { name: "Import and Categorize", exact: true }).click();
    await expect(page.getByText("Imported 2 transactions, skipped 0.")).toBeVisible();

    expect(await prisma.transaction.count({
      where: { description: { startsWith: "QA debit" } },
    })).toBe(1);
    expect(await prisma.transaction.count({
      where: { description: { startsWith: "QA credit" } },
    })).toBe(1);
  });

  test("invalid rows are reported and excluded from the import", async ({ page }) => {
    const csv = [
      "date,description,amount",
      "2027-01-08,QA valid row,-4.25",
      "2027-02-30,QA impossible date,-99.00",
      "2027-01-09,QA invalid amount,not-money",
    ].join("\n");

    await uploadCsvInUi(page, csv, "invalid-rows.csv");
    await expect(page.getByText(/1 valid, 2 invalid, 0 duplicate/)).toBeVisible();
    await expect(page.getByText(/missing or invalid date/i)).toBeVisible();
    await page.getByRole("button", { name: "Import and Categorize", exact: true }).click();
    await expect(page.getByText("Imported 1 transactions, skipped 2.")).toBeVisible();

    expect(await prisma.transaction.count({
      where: { description: { startsWith: "QA " }, date: { gte: new Date("2027-01-08") } },
    })).toBe(1);
  });

  test("manual remapping updates preview and import without stale values", async ({ page }) => {
    const csv = "when,who,value\n2027-01-10,QA manually mapped,-6.50\n";
    await uploadCsvInUi(page, csv, "manual-map.csv");
    await expect(page.getByText(/0 valid/)).toBeVisible();

    await page.getByLabel("Date").selectOption("when");
    await page.getByLabel("Description").selectOption("who");
    await page.getByLabel("Signed amount").selectOption("value");
    await expect(page.getByText("Previewed 1 importable rows from 1 data rows.")).toBeVisible();
    await expect(page.getByText("Expenses $6.50")).toBeVisible();
    await page.getByRole("button", { name: "Import and Categorize", exact: true }).click();
    await expect(page.getByText("Imported 1 transactions, skipped 0.")).toBeVisible();

    const row = await prisma.transaction.findFirstOrThrow({
      where: { description: "QA manually mapped" },
    });
    expect(Number(row.amount)).toBe(6.5);
    expect(row.direction).toBe("expense");
  });

  test("first import succeeds and a second identical import is rejected", async ({ request }) => {
    const csv = "date,description,amount\n2027-01-11,QA duplicate retry,-3.25\n";
    const first = await uploadCsv(request, csv, { filename: "first.csv" });
    const second = await uploadCsv(request, csv, { filename: "second.csv" });
    const preview = await uploadCsv(request, csv, { filename: "preview.csv", preview: true });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(409);
    expect(await preview.json()).toMatchObject({
      validRowCount: 0,
      duplicateCount: 1,
      incomeTotal: 0,
      expenseTotal: 0,
    });
    expect(await prisma.transaction.count({ where: { description: "QA duplicate retry" } })).toBe(1);
  });

  test("partially overlapping import inserts and totals only the new row", async ({ request }) => {
    const first = [
      "date,description,amount",
      "2027-01-12,QA overlap old,-10.00",
      "2027-01-13,QA overlap shared,20.00",
    ].join("\n");
    const second = [
      "date,description,amount",
      "2027-01-13,QA overlap shared,20.00",
      "2027-01-14,QA overlap new,-7.50",
    ].join("\n");

    expect((await uploadCsv(request, first, { filename: "overlap-a.csv" })).status()).toBe(200);
    const response = await uploadCsv(request, second, { filename: "overlap-b.csv" });
    const payload = await response.json() as { batchId: string; importedCount: number; duplicateCount: number };
    const batch = await prisma.uploadBatch.findUniqueOrThrow({ where: { id: payload.batchId } });

    expect(payload).toMatchObject({ importedCount: 1, duplicateCount: 1 });
    expect(Number(batch.incomeTotal)).toBe(0);
    expect(Number(batch.expenseTotal)).toBe(7.5);
  });

  test("concurrent repeated imports remain idempotent", async ({ request }) => {
    const csv = "date,description,amount\n2027-01-15,QA concurrent retry,-2.00\n";
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        uploadCsv(request, csv, { filename: `concurrent-${index}.csv` }),
      ),
    );

    expect(responses.filter((response) => response.status() === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status() === 409)).toHaveLength(4);
    expect(await prisma.transaction.count({ where: { description: "QA concurrent retry" } })).toBe(1);
    expect(await prisma.uploadBatch.count({
      where: { filename: { startsWith: "concurrent-" } },
    })).toBe(1);
  });
});
