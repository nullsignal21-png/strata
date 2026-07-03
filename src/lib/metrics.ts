import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JobFinancial = {
  id: string;
  name: string;
  customerName: string;
  tradeType: string;
  status: string;
  estimatedRevenue: number;
  actualRevenue: number;
  materialCosts: number;
  otherExpenses: number;
  totalCosts: number;
  grossProfit: number;
  margin: number;
};

export type TransactionRow = {
  id: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  aiCategory: string;
  confidence: number;
  status: string;
  jobId: string | null;
  jobName: string | null;
};

function money(value: unknown) {
  return Number(value ?? 0);
}

export async function getDemoCompany() {
  return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getCompanyOrNull() {
  try {
    return await getDemoCompany();
  } catch {
    return null;
  }
}

export async function getJobsWithFinancials(companyId?: string): Promise<JobFinancial[]> {
  try {
    const company = companyId ? { id: companyId } : await getDemoCompany();
    if (!company) return [];

    const jobs = await prisma.job.findMany({
      where: { companyId: company.id },
      include: { transactions: true },
      orderBy: { createdAt: "asc" },
    });

    return jobs.map((job) => {
      const materialCosts = job.transactions
        .filter((transaction) => transaction.aiCategory === "Materials")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0);
      const totalCosts = job.transactions.reduce((sum, transaction) => sum + money(transaction.amount), 0);
      const actualRevenue = money(job.actualRevenue);
      const grossProfit = actualRevenue - totalCosts;

      return {
        id: job.id,
        name: job.name,
        customerName: job.customerName,
        tradeType: job.tradeType,
        status: job.status,
        estimatedRevenue: money(job.estimatedRevenue),
        actualRevenue,
        materialCosts,
        otherExpenses: totalCosts - materialCosts,
        totalCosts,
        grossProfit,
        margin: actualRevenue > 0 ? grossProfit / actualRevenue : 0,
      };
    });
  } catch {
    return [];
  }
}

export async function getDashboardMetrics() {
  try {
    const company = await getDemoCompany();
    if (!company) return null;

    const [jobs, uncategorizedCount, unassignedCount, uploadBatches] = await Promise.all([
      getJobsWithFinancials(company.id),
      prisma.transaction.count({
        where: {
          companyId: company.id,
          OR: [{ aiCategory: "Uncategorized" }, { status: TransactionStatus.needs_review }],
        },
      }),
      prisma.transaction.count({ where: { companyId: company.id, jobId: null } }),
      prisma.uploadBatch.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

    const totalRevenue = jobs.reduce((sum, job) => sum + job.actualRevenue, 0);
    const totalJobCosts = jobs.reduce((sum, job) => sum + job.totalCosts, 0);
    const grossProfit = totalRevenue - totalJobCosts;
    const averageMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;

    return {
      company,
      totalRevenue,
      totalJobCosts,
      grossProfit,
      averageMargin,
      uncategorizedCount,
      unassignedCount,
      topJobs: [...jobs].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5),
      atRiskJobs: jobs.filter((job) => job.margin < 0.2),
      uploadBatches: uploadBatches.map((batch) => ({
        id: batch.id,
        filename: batch.filename,
        importedCount: batch.importedCount,
        createdAt: batch.createdAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}

export async function getTransactions(companyId?: string): Promise<TransactionRow[]> {
  try {
    const company = companyId ? { id: companyId } : await getDemoCompany();
    if (!company) return [];

    const transactions = await prisma.transaction.findMany({
      where: { companyId: company.id },
      include: { job: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date.toISOString(),
      merchant: transaction.merchant,
      description: transaction.description,
      amount: money(transaction.amount),
      aiCategory: transaction.aiCategory,
      confidence: transaction.confidence,
      status: transaction.status,
      jobId: transaction.jobId,
      jobName: transaction.job?.name ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getJobDetail(jobId: string) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { transactions: { orderBy: { date: "desc" } }, company: true },
    });

    if (!job) return null;

    const materialCosts = job.transactions
      .filter((transaction) => transaction.aiCategory === "Materials")
      .reduce((sum, transaction) => sum + money(transaction.amount), 0);
    const totalCosts = job.transactions.reduce((sum, transaction) => sum + money(transaction.amount), 0);
    const actualRevenue = money(job.actualRevenue);
    const grossProfit = actualRevenue - totalCosts;

    return {
      job: {
        id: job.id,
        name: job.name,
        customerName: job.customerName,
        tradeType: job.tradeType,
        status: job.status,
        estimatedRevenue: money(job.estimatedRevenue),
        actualRevenue,
        materialCosts,
        otherExpenses: totalCosts - materialCosts,
        totalCosts,
        grossProfit,
        margin: actualRevenue > 0 ? grossProfit / actualRevenue : 0,
      },
      transactions: job.transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date.toISOString(),
        merchant: transaction.merchant,
        description: transaction.description,
        amount: money(transaction.amount),
        aiCategory: transaction.aiCategory,
        confidence: transaction.confidence,
        status: transaction.status,
        jobId: job.id,
        jobName: job.name,
      })),
    };
  } catch {
    return null;
  }
}

export async function getReportData() {
  try {
    const company = await getDemoCompany();
    if (!company) return null;

    const [jobs, transactions] = await Promise.all([getJobsWithFinancials(company.id), getTransactions(company.id)]);
    const categorySpend = new Map<string, number>();
    const monthlySpend = new Map<string, number>();

    for (const transaction of transactions) {
      categorySpend.set(transaction.aiCategory, (categorySpend.get(transaction.aiCategory) ?? 0) + transaction.amount);
      const month = transaction.date.slice(0, 7);
      monthlySpend.set(month, (monthlySpend.get(month) ?? 0) + transaction.amount);
    }

    return {
      company,
      jobs,
      transactions,
      categorySpend: Array.from(categorySpend.entries()).map(([category, amount]) => ({ category, amount })),
      monthlySpend: Array.from(monthlySpend.entries()).map(([month, amount]) => ({ month, amount })),
      unassignedCosts: transactions
        .filter((transaction) => !transaction.jobId)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      lowMarginJobs: jobs.filter((job) => job.margin < 0.2),
    };
  } catch {
    return null;
  }
}
