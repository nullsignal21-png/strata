import { AppShell } from "@/components/AppShell";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { TransactionTable } from "@/components/TransactionTable";
import { getCompanyOrNull, getJobsWithFinancials, getTransactions } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const company = await getCompanyOrNull();
  const [transactions, jobs] = company ? await Promise.all([getTransactions(company.id), getJobsWithFinancials(company.id)]) : [[], []];

  return (
    <AppShell>
      {!company ? (
        <SetupEmptyState />
      ) : (
        <div className="grid gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Review workflow</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Transactions</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Low-confidence and unassigned transactions stay visible until the owner corrects them.
            </p>
          </div>
          <TransactionTable initialTransactions={transactions} jobs={jobs} />
        </div>
      )}
    </AppShell>
  );
}
