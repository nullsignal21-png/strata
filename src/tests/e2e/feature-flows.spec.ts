import Papa from "papaparse";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { getJobsWithFinancials } from "@/lib/metrics";
import { resetDemo, uploadCsv } from "./helpers";

const prisma = new PrismaClient();

test.describe("transaction, job, report, export, and reset flows", () => {
  test.beforeEach(async ({ request }) => resetDemo(request));
  test.afterEach(async ({ request }) => resetDemo(request));
  test.afterAll(async () => prisma.$disconnect());

  test("transaction correction, filters, review state, and refresh persist", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByLabel("Search").fill("Unclear ACH debit 8372");
    const row = page.getByRole("row").filter({ hasText: "Unclear ACH debit 8372" });
    await expect(row).toBeVisible();

    const direction = page.getByLabel("Direction for Unknown ACH");
    const category = page.getByLabel("Category for Unknown ACH");
    const assignedJob = page.getByLabel("Assigned job for Unknown ACH");
    const patch = () => page.waitForResponse(
      (response) => response.url().endsWith("/api/transactions") && response.request().method() === "PATCH",
    );

    let responsePromise = patch();
    await direction.selectOption("income");
    expect((await responsePromise).status()).toBe(200);
    await expect(category).toHaveValue("Uncategorized Income");

    responsePromise = patch();
    await direction.selectOption("expense");
    expect((await responsePromise).status()).toBe(200);
    await expect(category).toHaveValue("Uncategorized");

    responsePromise = patch();
    await category.selectOption("Materials");
    expect((await responsePromise).status()).toBe(200);

    responsePromise = patch();
    await assignedJob.selectOption({ index: 1 });
    expect((await responsePromise).status()).toBe(200);
    const firstJobId = await assignedJob.inputValue();

    responsePromise = patch();
    await assignedJob.selectOption({ index: 2 });
    expect((await responsePromise).status()).toBe(200);
    await expect(assignedJob).not.toHaveValue(firstJobId);

    responsePromise = patch();
    await assignedJob.selectOption("unassigned");
    expect((await responsePromise).status()).toBe(200);
    await expect(assignedJob).toHaveValue("unassigned");

    responsePromise = patch();
    await assignedJob.selectOption(firstJobId);
    expect((await responsePromise).status()).toBe(200);

    responsePromise = patch();
    await row.getByRole("button", { name: "Unreview" }).click();
    expect((await responsePromise).status()).toBe(200);
    await expect(row.getByText("Needs review")).toBeVisible();
    responsePromise = patch();
    await row.getByRole("button", { name: "Review", exact: true }).click();
    expect((await responsePromise).status()).toBe(200);
    await expect(row.getByText("Reviewed")).toBeVisible();

    await page.reload();
    await page.getByLabel("Search").fill("Unclear ACH debit 8372");
    const refreshed = page.getByRole("row").filter({ hasText: "Unclear ACH debit 8372" });
    await expect(refreshed.getByLabel("Category for Unknown ACH")).toHaveValue("Materials");
    await expect(refreshed.getByLabel("Assigned job for Unknown ACH")).not.toHaveValue("unassigned");

    await page.getByLabel("Category filter").selectOption("categorized");
    await page.getByLabel("Job filter").selectOption("assigned");
    await page.getByLabel("Review filter").selectOption("reviewed");
    await expect(refreshed).toBeVisible();
    await page.getByLabel("Start date filter").fill("2026-06-21");
    await page.getByLabel("End date filter").fill("2026-06-21");
    await expect(refreshed).toBeVisible();

    const stored = await prisma.transaction.findFirstOrThrow({
      where: { description: "Unclear ACH debit 8372" },
    });
    expect(stored).toMatchObject({ aiCategory: "Materials", status: "reviewed" });
    expect(stored.jobId).not.toBeNull();
  });

  test("bulk review, categorization, and suggested-job assignment persist", async ({ page, request }) => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const needsReview = await prisma.transaction.findMany({
      where: { companyId: company.id, status: "needs_review" },
      orderBy: { date: "desc" },
      take: 2,
    });
    expect(needsReview).toHaveLength(2);

    await page.goto("/transactions");
    for (const transaction of needsReview) {
      await page.getByRole("row")
        .filter({ hasText: transaction.description })
        .getByRole("checkbox")
        .check();
    }
    await page.getByRole("button", { name: "Bulk review" }).click();
    await expect(page.getByText("Updated 2 transactions.")).toBeVisible();
    expect(await prisma.transaction.count({
      where: { id: { in: needsReview.map(({ id }) => id) }, status: "reviewed" },
    })).toBe(2);

    await page.getByLabel("Search").fill("Unclear ACH debit 8372");
    await page.getByRole("row")
      .filter({ hasText: "Unclear ACH debit 8372" })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Bulk categorize" }).click();
    await expect(page.getByText("Updated 1 transactions.")).toBeVisible();

    const suggestionCsv = [
      "date,description,merchant,amount",
      "2027-02-10,QA suggested HVAC Cary alpha,QA Vendor,-10.00",
      "2027-02-11,QA suggested HVAC Cary beta,QA Vendor,-11.00",
    ].join("\n");
    expect((await uploadCsv(request, suggestionCsv, { filename: "suggestions.csv" })).status()).toBe(200);
    const suggested = await prisma.transaction.findMany({
      where: { companyId: company.id, description: { startsWith: "QA suggested" } },
      orderBy: { date: "asc" },
    });
    expect(suggested).toHaveLength(2);
    expect(new Set(suggested.map(({ suggestedJobId }) => suggestedJobId)).size).toBe(1);
    expect(suggested.every(({ jobId, suggestedJobId }) => !jobId && suggestedJobId)).toBe(true);

    await page.reload();
    await page.getByLabel("Search").fill("QA suggested");
    await page.getByLabel("Select visible transactions").check();
    await page.getByRole("button", { name: "Bulk assign suggestion" }).click();
    await expect(page.getByText("Updated 2 transactions.")).toBeVisible();

    const assigned = await prisma.transaction.findMany({
      where: { id: { in: suggested.map(({ id }) => id) } },
    });
    expect(assigned.every(({ jobId, suggestedJobId, status }) =>
      jobId === suggestedJobId && status === "reviewed")).toBe(true);
  });

  test("job CRUD supports dates, similar names, navigation history, and safe deletion", async ({ page, request }) => {
    await page.goto("/jobs");
    await page.getByRole("button", { name: "Create job" }).click();
    await page.getByLabel("Job name").fill("QA Browser Job");
    await page.getByLabel("Customer name").fill("QA Customer");
    await page.getByLabel("Trade type").selectOption("HVAC");
    await page.getByLabel("City").fill("Raleigh");
    await page.getByLabel("Address").fill("1 QA Way");
    await page.getByLabel("Estimated revenue").fill("1200.00");
    await page.getByLabel("Actual revenue").fill("1000.00");
    await page.getByLabel("Start date").fill("2027-02-01");
    await page.getByLabel("End date").fill("2027-02-03");
    await page.getByRole("button", { name: "Save job" }).click();
    const jobLink = page.getByRole("link", { name: "QA Browser Job" });
    await expect(jobLink).toBeVisible();

    const similar = await request.post("/api/jobs", {
      data: {
        name: "QA Browser Job - Phase 2",
        customerName: "QA Customer",
        tradeType: "HVAC",
        estimatedRevenue: 500,
        actualRevenue: 400,
      },
    });
    expect(similar.status()).toBe(201);

    await jobLink.click();
    await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "QA Browser Job" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(jobLink).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "QA Browser Job" })).toBeVisible();

    await page.getByLabel("Job name").fill("QA Browser Job Updated");
    await page.getByLabel("Customer name").fill("QA Customer Updated");
    await page.getByLabel("City").fill("");
    await page.getByLabel("Actual revenue").fill("900.00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Job updated.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Browser Job Updated" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    expect(await prisma.job.count({ where: { name: "QA Browser Job Updated" } })).toBe(0);
  });

  test("job profitability recalculates after assigning an expense", async ({ page, request }) => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const created = await request.post("/api/jobs", {
      data: {
        name: "QA Profitability Job",
        customerName: "QA Customer",
        tradeType: "HVAC",
        estimatedRevenue: 1000,
        actualRevenue: 1000,
      },
    });
    const { job } = await created.json() as { job: { id: string } };
    const imported = await uploadCsv(
      request,
      "date,description,merchant,amount\n2027-02-04,QA profitability expense,QA Supplier,-125.25\n",
      { filename: "profitability.csv" },
    );
    expect(imported.status()).toBe(200);
    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { companyId: company.id, description: "QA profitability expense" },
    });
    expect((await request.patch("/api/transactions", {
      data: { id: transaction.id, jobId: job.id, aiCategory: "Materials" },
    })).status()).toBe(200);

    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator("div").filter({ hasText: /^Total costs\$125$/ })).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^Gross profit\$875$/ })).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^Margin87%$/ })).toBeVisible();

    const financial = (await getJobsWithFinancials(company.id)).find(({ id }) => id === job.id);
    expect(financial).toMatchObject({
      actualRevenue: 1000,
      totalCosts: 125.25,
      grossProfit: 874.75,
    });
  });

  test("reports remain consistent with database-backed calculations", async ({ page }) => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const jobs = await getJobsWithFinancials(company.id);
    await page.goto("/reports");

    await expect(page.getByRole("heading", { name: "Profitability reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost by category" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monthly income versus expenses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cash collected versus job revenue" })).toBeVisible();
    for (const job of jobs) {
      await expect(page.getByRole("link", { name: job.name })).toBeVisible();
    }
  });

  test("exports preserve values, quoting, UTF-8, and neutralize formulas", async ({ request }) => {
    const csv = [
      "date,description,merchant,memo,amount",
      '2027-02-05,"Line one',
      'Line two","=Café, Services",@memo,-12.34',
    ].join("\n");
    expect((await uploadCsv(request, csv, { filename: "export-security.csv" })).status()).toBe(200);

    const transactionExport = await request.get("/api/export?type=quickbooks");
    const jobExport = await request.get("/api/export?type=job-profitability");
    const transactionCsv = await transactionExport.text();
    const transactions = Papa.parse<Record<string, string>>(transactionCsv, { header: true });
    const jobs = Papa.parse<Record<string, string>>(await jobExport.text(), { header: true });
    const exported = transactions.data.find(({ merchant }) => merchant.includes("Café"));

    expect(transactionExport.status()).toBe(200);
    expect(jobExport.status()).toBe(200);
    expect(transactions.errors).toEqual([]);
    expect(jobs.errors).toEqual([]);
    expect(exported).toMatchObject({
      date: "2027-02-05",
      merchant: "'=Café, Services",
      description: "Line one\nLine two",
      memo: "'@memo",
      direction: "expense",
      amount: "12.34",
    });
    expect(transactionCsv).not.toMatch(/DATABASE_URL|reset-token|uploadBatchId|fingerprint/i);
  });

  test("demo reset rejects a wrong token and visibly restores exact seed state", async ({ page, request }) => {
    expect((await request.post("/api/jobs", {
      data: {
        name: "QA Reset Mutation",
        customerName: "QA",
        tradeType: "QA",
        estimatedRevenue: 1,
        actualRevenue: 1,
      },
    })).status()).toBe(201);
    await page.goto("/settings");

    await page.getByLabel("Demo reset token").fill("incorrect-reset-token");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByText("Invalid demo reset token.")).toBeVisible();

    await page.getByLabel("Demo reset token").fill(process.env.DEMO_RESET_TOKEN!);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByText("Demo data reset successfully.")).toBeVisible();
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    expect(await prisma.job.count({ where: { companyId: company.id } })).toBe(5);
    expect(await prisma.transaction.count({ where: { companyId: company.id } })).toBe(32);
    expect(await prisma.categoryRule.count({ where: { companyId: company.id } })).toBe(19);
    expect(await prisma.uploadBatch.count({ where: { companyId: company.id } })).toBe(1);
    expect(await prisma.job.count({ where: { name: "QA Reset Mutation" } })).toBe(0);
  });
});
