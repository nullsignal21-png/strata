import { PrismaClient, TransactionDirection, TransactionStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as resetDemo } from "@/app/api/demo/reset/route";
import { getDashboardMetrics, getJobsWithFinancials, getReportData } from "@/lib/metrics";

const integrationEnabled =
  process.env.STRATA_INTEGRATION_DB === "true" &&
  /(?:127\.0\.0\.1|localhost)/.test(process.env.DATABASE_URL ?? "");
const describeIntegration = integrationEnabled ? describe : describe.skip;
const prisma = new PrismaClient();

function resetRequest() {
  return new Request("http://localhost/api/demo/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: process.env.DEMO_RESET_TOKEN }),
  });
}

function sumCents(values: Array<number | { toString(): string }>) {
  return values.reduce<number>((sum, value) => sum + Math.round(Number(value) * 100), 0);
}

describeIntegration("database-backed metrics and reports", () => {
  beforeEach(async () => {
    const response = await resetDemo(resetRequest());
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("matches dashboard and job metrics to independent database calculations", async () => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const [rawJobs, rawTransactions, metrics, jobs] = await Promise.all([
      prisma.job.findMany({ where: { companyId: company.id } }),
      prisma.transaction.findMany({ where: { companyId: company.id } }),
      getDashboardMetrics(),
      getJobsWithFinancials(company.id),
    ]);
    expect(metrics.state).toBe("ready");
    if (metrics.state !== "ready") return;

    const revenueCents = sumCents(rawJobs.map(({ actualRevenue }) => actualRevenue));
    const assignedExpenses = rawTransactions.filter(
      ({ direction, jobId }) => direction === TransactionDirection.expense && jobId,
    );
    const costCents = sumCents(assignedExpenses.map(({ amount }) => amount));
    const cashCents = sumCents(
      rawTransactions
        .filter(({ direction }) => direction === TransactionDirection.income)
        .map(({ amount }) => amount),
    );

    expect(Math.round(metrics.totalRevenue * 100)).toBe(revenueCents);
    expect(Math.round(metrics.totalJobCosts * 100)).toBe(costCents);
    expect(Math.round(metrics.grossProfit * 100)).toBe(revenueCents - costCents);
    expect(Math.round(metrics.cashCollected * 100)).toBe(cashCents);
    expect(metrics.unassignedCount).toBe(rawTransactions.filter(({ jobId }) => !jobId).length);
    expect(metrics.needsReviewCount).toBe(
      rawTransactions.filter(({ status }) => status === TransactionStatus.needs_review).length,
    );

    for (const job of jobs) {
      const raw = rawJobs.find(({ id }) => id === job.id)!;
      const transactions = rawTransactions.filter(({ jobId }) => jobId === job.id);
      const expectedCosts = sumCents(
        transactions
          .filter(({ direction }) => direction === TransactionDirection.expense)
          .map(({ amount }) => amount),
      );
      const expectedCash = sumCents(
        transactions
          .filter(({ direction }) => direction === TransactionDirection.income)
          .map(({ amount }) => amount),
      );
      const expectedRevenue = Math.round(Number(raw.actualRevenue) * 100);

      expect(Math.round(job.totalCosts * 100)).toBe(expectedCosts);
      expect(Math.round(job.cashCollected * 100)).toBe(expectedCash);
      expect(Math.round(job.grossProfit * 100)).toBe(expectedRevenue - expectedCosts);
      expect(Number.isFinite(job.margin)).toBe(true);
    }
  });

  it("matches report category and monthly totals to raw transactions", async () => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const transactions = await prisma.transaction.findMany({ where: { companyId: company.id } });
    const report = await getReportData();
    expect(report.state).toBe("ready");
    if (report.state !== "ready") return;

    const categories = new Map<string, number>();
    const months = new Map<string, { income: number; expense: number }>();
    for (const transaction of transactions) {
      const cents = Math.round(Number(transaction.amount) * 100);
      const month = transaction.date.toISOString().slice(0, 7);
      const monthly = months.get(month) ?? { income: 0, expense: 0 };
      if (transaction.direction === TransactionDirection.expense) {
        categories.set(transaction.aiCategory, (categories.get(transaction.aiCategory) ?? 0) + cents);
        monthly.expense += cents;
      } else {
        monthly.income += cents;
      }
      months.set(month, monthly);
    }

    expect(new Map(report.categorySpend.map(({ category, amount }) => [category, Math.round(amount * 100)])))
      .toEqual(categories);
    expect(new Map(report.monthlyIncomeExpense.map(({ month, income, expense }) => [
      month,
      { income: Math.round(income * 100), expense: Math.round(expense * 100) },
    ]))).toEqual(months);
    expect(report.categorySpend.map(({ amount }) => amount)).toEqual(
      [...report.categorySpend.map(({ amount }) => amount)].sort((left, right) => right - left),
    );
    expect(report.monthlyIncomeExpense.map(({ month }) => month)).toEqual(
      [...report.monthlyIncomeExpense.map(({ month }) => month)].sort(),
    );
  });

  it("updates totals after assignment and handles negative and zero revenue", async () => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const baseline = await getDashboardMetrics();
    expect(baseline.state).toBe("ready");
    if (baseline.state !== "ready") return;

    const unassignedExpense = await prisma.transaction.findFirstOrThrow({
      where: { companyId: company.id, jobId: null, direction: TransactionDirection.expense },
    });
    const zeroRevenueJob = await prisma.job.create({
      data: {
        companyId: company.id,
        name: `Zero Revenue ${crypto.randomUUID()}`,
        customerName: "QA",
        tradeType: "QA",
        status: "active",
        estimatedRevenue: 0,
        actualRevenue: 0,
      },
    });
    await prisma.transaction.update({
      where: { id: unassignedExpense.id },
      data: { jobId: zeroRevenueJob.id, status: TransactionStatus.reviewed },
    });

    const updated = await getDashboardMetrics();
    const jobs = await getJobsWithFinancials(company.id);
    expect(updated.state).toBe("ready");
    if (updated.state !== "ready") return;
    const zeroRevenue = jobs.find(({ id }) => id === zeroRevenueJob.id)!;

    expect(Math.round(updated.totalJobCosts * 100)).toBe(
      Math.round((baseline.totalJobCosts + Number(unassignedExpense.amount)) * 100),
    );
    expect(zeroRevenue.grossProfit).toBe(-Number(unassignedExpense.amount));
    expect(zeroRevenue.margin).toBe(0);
    expect(Number.isFinite(zeroRevenue.margin)).toBe(true);
  });

  it("returns finite zero totals and empty report collections for an empty company", async () => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { companyId: company.id } }),
      prisma.uploadBatch.deleteMany({ where: { companyId: company.id } }),
      prisma.job.deleteMany({ where: { companyId: company.id } }),
    ]);

    const metrics = await getDashboardMetrics();
    const report = await getReportData();
    expect(metrics.state).toBe("ready");
    expect(report.state).toBe("ready");
    if (metrics.state !== "ready" || report.state !== "ready") return;

    expect(metrics).toMatchObject({
      totalRevenue: 0,
      totalJobCosts: 0,
      grossProfit: 0,
      averageMargin: 0,
      cashCollected: 0,
      uncategorizedCount: 0,
      unassignedCount: 0,
      needsReviewCount: 0,
      topJobs: [],
      atRiskJobs: [],
      uploadBatches: [],
    });
    expect(Number.isFinite(metrics.averageMargin)).toBe(true);
    expect(report).toMatchObject({
      jobs: [],
      transactions: [],
      categorySpend: [],
      monthlyIncomeExpense: [],
      unassignedExpenses: 0,
      lowMarginJobs: [],
      cashVsRevenue: [],
    });
  });
});
