import type { JobFinancial, TransactionRow } from "@/lib/metrics";

export function escapeCsvCell(value: string | number | null) {
  const text = String(value ?? "");
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: Array<Array<string | number | null>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildQuickBooksTransactionCsv(transactions: TransactionRow[]) {
  const rows: Array<Array<string | number | null>> = [
    ["date", "transaction_type", "merchant", "description", "memo", "direction", "amount", "category", "job"],
  ];

  for (const transaction of transactions) {
    rows.push([
      transaction.date.slice(0, 10),
      transaction.direction === "income" ? "Deposit" : "Expense",
      transaction.merchant,
      transaction.description,
      transaction.memo,
      transaction.direction,
      transaction.amount.toFixed(2),
      transaction.aiCategory,
      transaction.jobName ?? "Unassigned",
    ]);
  }

  return rowsToCsv(rows);
}

export function buildJobProfitabilityCsv(jobs: JobFinancial[]) {
  const rows: Array<Array<string | number | null>> = [
    [
      "job_name",
      "customer",
      "trade_type",
      "status",
      "actual_revenue",
      "cash_collected",
      "job_costs",
      "gross_profit",
      "margin",
    ],
  ];

  for (const job of jobs) {
    rows.push([
      job.name,
      job.customerName,
      job.tradeType,
      job.status,
      job.actualRevenue.toFixed(2),
      job.cashCollected.toFixed(2),
      job.totalCosts.toFixed(2),
      job.grossProfit.toFixed(2),
      Math.round(job.margin * 10000) / 100,
    ]);
  }

  return rowsToCsv(rows);
}
