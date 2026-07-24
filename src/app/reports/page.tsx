import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { JobProfitTable } from "@/components/JobProfitTable";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { formatCurrency } from "@/lib/format";
import { getReportData } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const report = await getReportData();

  return (
    <AppShell>
      {report.state !== "ready" ? (
        <SetupEmptyState message={report.message} showCommands={report.state !== "database_unavailable"} />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Investor demo report</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">Profitability reports</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Accounting-ready CSV export and job-level reporting without building a full accounting platform.
              </p>
            </div>
            <a
              href="/api/export?type=quickbooks"
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download size={17} />
              QuickBooks CSV
            </a>
            <a
              href="/api/export?type=job-profitability"
              className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download size={17} />
              Job CSV
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Unassigned expenses</p>
              <p className="mt-3 text-3xl font-semibold">{formatCurrency(report.unassignedExpenses)}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Low-margin jobs</p>
              <p className="mt-3 text-3xl font-semibold">{report.lowMarginJobs.length}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Transactions</p>
              <p className="mt-3 text-3xl font-semibold">{report.transactions.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Cost by category</h2>
              <div className="mt-5 grid gap-3">
                {report.categorySpend.map((item) => (
                  <div key={item.category} className="flex justify-between rounded-md bg-slate-50 px-4 py-3">
                    <span>{item.category}</span>
                    <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Monthly income versus expenses</h2>
              <div className="mt-5 grid gap-3">
                {report.monthlyIncomeExpense.map((item) => (
                  <div key={item.month} className="flex justify-between rounded-md bg-slate-50 px-4 py-3">
                    <span>{item.month}</span>
                    <span className="font-semibold">
                      {formatCurrency(item.income)} / {formatCurrency(item.expense)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Cash collected versus job revenue</h2>
            <div className="mt-5 grid gap-3">
              {report.cashVsRevenue.map((item) => (
                <div key={item.jobId} className="grid gap-2 rounded-md bg-slate-50 px-4 py-3 md:grid-cols-[1fr_auto]">
                  <span className="font-medium">{item.jobName}</span>
                  <span>
                    Cash {formatCurrency(item.cashCollected)} / revenue {formatCurrency(item.actualRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <JobProfitTable jobs={report.jobs} title="Profitability by job" />
        </div>
      )}
    </AppShell>
  );
}
