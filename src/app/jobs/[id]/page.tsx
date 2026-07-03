import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ProfitChart } from "@/components/ProfitChart";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatCurrencyPrecise, formatDate, formatPercent } from "@/lib/format";
import { getJobDetail } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getJobDetail(id);

  return (
    <AppShell>
      {!detail ? (
        <SetupEmptyState />
      ) : (
        <div className="grid gap-6">
          <div>
            <Link href="/jobs" className="text-sm font-semibold text-teal-700 hover:text-teal-900">
              Back to jobs
            </Link>
            <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{detail.job.customerName}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">{detail.job.name}</h1>
                <p className="mt-3 text-slate-600">
                  {detail.job.tradeType} job with {formatCurrency(detail.job.actualRevenue)} actual revenue.
                </p>
              </div>
              <StatusBadge status={detail.job.status} />
            </div>
          </div>

          {detail.job.margin < 0.2 ? (
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-950">
              <AlertTriangle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">{detail.job.margin < 0.1 ? "At risk" : "Low margin"}</p>
                <p className="mt-1 text-sm">Margin is {formatPercent(detail.job.margin)}. Review job assignments and material costs.</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Revenue", formatCurrency(detail.job.actualRevenue)],
              ["Total costs", formatCurrency(detail.job.totalCosts)],
              ["Gross profit", formatCurrency(detail.job.grossProfit)],
              ["Margin", formatPercent(detail.job.margin)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <ProfitChart jobs={[detail.job]} />
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Cost breakdown</h2>
              <div className="mt-5 grid gap-3">
                <div className="flex justify-between rounded-md bg-teal-50 px-4 py-3">
                  <span>Materials</span>
                  <span className="font-semibold">{formatCurrency(detail.job.materialCosts)}</span>
                </div>
                <div className="flex justify-between rounded-md bg-slate-100 px-4 py-3">
                  <span>Other expenses</span>
                  <span className="font-semibold">{formatCurrency(detail.job.otherExpenses)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
            <div className="border-b border-black/10 px-5 py-4">
              <h2 className="text-lg font-semibold">Assigned transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Merchant</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-5 py-4">{formatDate(transaction.date)}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium">{transaction.merchant}</p>
                        <p className="mt-1 text-xs text-slate-500">{transaction.description}</p>
                      </td>
                      <td className="px-5 py-4">
                        <CategoryBadge category={transaction.aiCategory} />
                      </td>
                      <td className="px-5 py-4 text-right">{formatCurrencyPrecise(transaction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
