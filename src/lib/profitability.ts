import type { TransactionDirectionValue } from "@/lib/categories";

export type ProfitabilityTransaction = {
  amount: number;
  direction: TransactionDirectionValue;
};

export function calculateJobProfitability(actualRevenue: number, transactions: ProfitabilityTransaction[]) {
  const jobCosts = transactions
    .filter((transaction) => transaction.direction === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const cashCollected = transactions
    .filter((transaction) => transaction.direction === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const grossProfit = actualRevenue - jobCosts;

  return {
    actualRevenue,
    jobCosts,
    cashCollected,
    grossProfit,
    margin: actualRevenue > 0 ? grossProfit / actualRevenue : 0,
  };
}
