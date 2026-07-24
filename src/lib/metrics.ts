import { TransactionDirection, TransactionStatus, type Company } from "@prisma/client";
import { ensureDemoData } from "@/lib/demoData";
import { getEnv, isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";
import { calculateJobProfitability, sumMoney } from "@/lib/profitability";

export type SetupState =
  | { state: "database_unavailable"; message: string }
  | { state: "demo_missing"; message: string };

export type CompanyState = SetupState | { state: "ready"; company: Company };

export type JobFinancial = {
  id: string;
  name: string;
  customerName: string;
  tradeType: string;
  city: string | null;
  address: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  estimatedRevenue: number;
  actualRevenue: number;
  cashCollected: number;
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
  memo: string | null;
  amount: number;
  direction: "income" | "expense";
  aiCategory: string;
  confidence: number;
  status: string;
  jobId: string | null;
  jobName: string | null;
  suggestedJobId: string | null;
  suggestedJobName: string | null;
  matchConfidence: number;
  matchReason: string | null;
  uploadBatchId: string | null;
  uploadBatchFilename: string | null;
};

function money(value: unknown) {
  return Number(value ?? 0);
}

function setupError(error: unknown): SetupState {
  logger.error("database_health_failure", {
    error: error instanceof Error ? error.name : "unknown",
  });
  return {
    state: "database_unavailable",
    message: "Database is unavailable. Check DATABASE_URL, deployed migrations, and Prisma Postgres connectivity.",
  };
}

export async function getDemoCompany() {
  const prisma = getPrisma();
  const slug = getEnv().DEMO_COMPANY_SLUG;
  let company = await prisma.company.findUnique({ where: { slug } });

  if (!company && isDemoMode()) {
    company = await ensureDemoData();
  }

  return company;
}

export async function getCompanyState(): Promise<CompanyState> {
  try {
    const company = await getDemoCompany();
    if (!company) {
      return {
        state: "demo_missing",
        message: "Database is reachable, but the demo company is absent. Run the idempotent seed or enable DEMO_MODE.",
      };
    }

    return { state: "ready", company };
  } catch (error) {
    return setupError(error);
  }
}

export async function getCompanyOrNull() {
  const state = await getCompanyState();
  return state.state === "ready" ? state.company : null;
}

export async function getJobsWithFinancials(companyId?: string): Promise<JobFinancial[]> {
  const company = companyId ? { id: companyId } : await getDemoCompany();
  if (!company) return [];

  const prisma = getPrisma();
  const jobs = await prisma.job.findMany({
    where: { companyId: company.id },
    include: { transactions: true },
    orderBy: { createdAt: "asc" },
  });

  return jobs.map((job) => {
    const expenseTransactions = job.transactions.filter((transaction) => transaction.direction === TransactionDirection.expense);
    const materialCosts = sumMoney(
      expenseTransactions
        .filter((transaction) => transaction.aiCategory === "Materials")
        .map((transaction) => money(transaction.amount)),
    );
    const profitability = calculateJobProfitability(
      money(job.actualRevenue),
      job.transactions.map((transaction) => ({
        amount: money(transaction.amount),
        direction: transaction.direction,
      })),
    );

    return {
      id: job.id,
      name: job.name,
      customerName: job.customerName,
      tradeType: job.tradeType,
      city: job.city,
      address: job.address,
      startDate: job.startDate?.toISOString() ?? null,
      endDate: job.endDate?.toISOString() ?? null,
      status: job.status,
      estimatedRevenue: money(job.estimatedRevenue),
      actualRevenue: profitability.actualRevenue,
      cashCollected: profitability.cashCollected,
      materialCosts,
      otherExpenses: sumMoney([profitability.jobCosts, -materialCosts]),
      totalCosts: profitability.jobCosts,
      grossProfit: profitability.grossProfit,
      margin: profitability.margin,
    };
  });
}

export async function getDashboardMetrics() {
  try {
    const company = await getDemoCompany();
    if (!company) {
      return {
        state: "demo_missing" as const,
        message: "Database is reachable, but the demo company is absent. Run npm run db:seed.",
      };
    }

    const prisma = getPrisma();
    const [jobs, uncategorizedCount, unassignedCount, needsReviewCount, cashCollected, uploadBatches] =
      await Promise.all([
        getJobsWithFinancials(company.id),
        prisma.transaction.count({
          where: {
            companyId: company.id,
            aiCategory: { in: ["Uncategorized", "Uncategorized Income"] },
          },
        }),
        prisma.transaction.count({ where: { companyId: company.id, jobId: null } }),
        prisma.transaction.count({ where: { companyId: company.id, status: TransactionStatus.needs_review } }),
        prisma.transaction.aggregate({
          where: { companyId: company.id, direction: TransactionDirection.income },
          _sum: { amount: true },
        }),
        prisma.uploadBatch.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 3 }),
      ]);

    const totalRevenue = sumMoney(jobs.map((job) => job.actualRevenue));
    const totalJobCosts = sumMoney(jobs.map((job) => job.totalCosts));
    const grossProfit = sumMoney([totalRevenue, -totalJobCosts]);
    const averageMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;

    return {
      state: "ready" as const,
      company,
      totalRevenue,
      totalJobCosts,
      grossProfit,
      averageMargin,
      cashCollected: money(cashCollected._sum.amount),
      uncategorizedCount,
      unassignedCount,
      needsReviewCount,
      topJobs: [...jobs].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5),
      atRiskJobs: jobs.filter((job) => job.margin < 0.2),
      uploadBatches: uploadBatches.map((batch) => ({
        id: batch.id,
        filename: batch.filename,
        importedCount: batch.importedCount,
        duplicateCount: batch.duplicateCount,
        invalidCount: batch.invalidCount,
        createdAt: batch.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return setupError(error);
  }
}

export async function getTransactions(companyId?: string): Promise<TransactionRow[]> {
  const company = companyId ? { id: companyId } : await getDemoCompany();
  if (!company) return [];

  const prisma = getPrisma();
  const transactions = await prisma.transaction.findMany({
    where: { companyId: company.id },
    include: { job: true, uploadBatch: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const suggestedIds = transactions.map((transaction) => transaction.suggestedJobId).filter(Boolean) as string[];
  const suggestedJobs = suggestedIds.length
    ? await prisma.job.findMany({ where: { id: { in: suggestedIds } }, select: { id: true, name: true } })
    : [];
  const suggestedById = new Map(suggestedJobs.map((job) => [job.id, job.name]));

  return transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date.toISOString(),
    merchant: transaction.merchant,
    description: transaction.description,
    memo: transaction.memo,
    amount: money(transaction.amount),
    direction: transaction.direction,
    aiCategory: transaction.aiCategory,
    confidence: transaction.confidence,
    status: transaction.status,
    jobId: transaction.jobId,
    jobName: transaction.job?.name ?? null,
    suggestedJobId: transaction.suggestedJobId,
    suggestedJobName: transaction.suggestedJobId ? suggestedById.get(transaction.suggestedJobId) ?? null : null,
    matchConfidence: transaction.matchConfidence,
    matchReason: transaction.matchReason,
    uploadBatchId: transaction.uploadBatchId,
    uploadBatchFilename: transaction.uploadBatch?.filename ?? null,
  }));
}

export async function getJobDetail(jobId: string) {
  const prisma = getPrisma();
  const company = await getDemoCompany();
  if (!company) return null;
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: company.id },
    include: { transactions: { orderBy: { date: "desc" } }, company: true },
  });

  if (!job) return null;

  const rows = await getTransactions(job.companyId);
  const jobRows = rows.filter((transaction) => transaction.jobId === job.id);
  const financial = (await getJobsWithFinancials(job.companyId)).find((candidate) => candidate.id === job.id);
  if (!financial) return null;

  const expenseBreakdown = new Map<string, number>();
  for (const transaction of jobRows.filter((row) => row.direction === "expense")) {
    expenseBreakdown.set(
      transaction.aiCategory,
      sumMoney([expenseBreakdown.get(transaction.aiCategory) ?? 0, transaction.amount]),
    );
  }

  return {
    job: financial,
    company: job.company,
    transactions: jobRows,
    expenseBreakdown: Array.from(expenseBreakdown.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category)),
  };
}

export async function getReportData() {
  try {
    const company = await getDemoCompany();
    if (!company) {
      return {
        state: "demo_missing" as const,
        message: "Database is reachable, but the demo company is absent. Run npm run db:seed.",
      };
    }

    const [jobs, transactions] = await Promise.all([getJobsWithFinancials(company.id), getTransactions(company.id)]);
    const categorySpend = new Map<string, number>();
    const monthly = new Map<string, { income: number; expense: number }>();

    for (const transaction of transactions) {
      const month = transaction.date.slice(0, 7);
      const current = monthly.get(month) ?? { income: 0, expense: 0 };
      if (transaction.direction === "expense") {
        categorySpend.set(
          transaction.aiCategory,
          sumMoney([categorySpend.get(transaction.aiCategory) ?? 0, transaction.amount]),
        );
        current.expense = sumMoney([current.expense, transaction.amount]);
      } else {
        current.income = sumMoney([current.income, transaction.amount]);
      }
      monthly.set(month, current);
    }

    return {
      state: "ready" as const,
      company,
      jobs,
      transactions,
      categorySpend: Array.from(categorySpend.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category)),
      monthlyIncomeExpense: Array.from(monthly.entries())
        .map(([month, totals]) => ({ month, ...totals }))
        .sort((left, right) => left.month.localeCompare(right.month)),
      unassignedExpenses: transactions
        .filter((transaction) => transaction.direction === "expense" && !transaction.jobId)
        .reduce((sum, transaction) => sumMoney([sum, transaction.amount]), 0),
      lowMarginJobs: jobs.filter((job) => job.margin < 0.2),
      cashVsRevenue: jobs.map((job) => ({
        jobId: job.id,
        jobName: job.name,
        actualRevenue: job.actualRevenue,
        cashCollected: job.cashCollected,
      })),
    };
  } catch (error) {
    return setupError(error);
  }
}
