import type { TransactionDirectionValue } from "@/lib/categories";

export type ProfitabilityTransaction = {
  amount: number;
  direction: TransactionDirectionValue;
};

export function sumMoney(values: number[]) {
  return values.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100;
}

export function calculateJobProfitability(actualRevenue: number, transactions: ProfitabilityTransaction[]) {
  const normalizedRevenue = sumMoney([actualRevenue]);
  const jobCosts = sumMoney(
    transactions
      .filter((transaction) => transaction.direction === "expense")
      .map((transaction) => transaction.amount),
  );
  const cashCollected = sumMoney(
    transactions
      .filter((transaction) => transaction.direction === "income")
      .map((transaction) => transaction.amount),
  );
  const grossProfit = sumMoney([normalizedRevenue, -jobCosts]);

  return {
    actualRevenue: normalizedRevenue,
    jobCosts,
    cashCollected,
    grossProfit,
    margin: normalizedRevenue > 0 ? grossProfit / normalizedRevenue : 0,
  };
}
