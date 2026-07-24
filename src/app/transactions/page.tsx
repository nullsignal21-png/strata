import { AppShell } from "@/components/AppShell";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { TransactionTable } from "@/components/TransactionTable";
import { getCompanyState, getJobsWithFinancials, getTransactions } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const state = await getCompanyState();
  const [transactions, jobs] =
    state.state === "ready"
      ? await Promise.all([getTransactions(state.company.id), getJobsWithFinancials(state.company.id)])
      : [[], []];

  return (
    <AppShell>
      {state.state !== "ready" ? (
        <SetupEmptyState message={state.message} showCommands={state.state !== "database_unavailable"} />
      ) : (
        <div className="grid grid-cols-1 gap-6">
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
