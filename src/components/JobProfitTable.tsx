import Link from "next/link";
import type { JobFinancial } from "@/lib/metrics";
import { formatCurrency, formatPercent } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export function JobProfitTable({ jobs, title = "Job profitability" }: { jobs: JobFinancial[]; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Job</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Revenue</th>
              <th className="px-5 py-3 text-right">Cash</th>
              <th className="px-5 py-3 text-right">Costs</th>
              <th className="px-5 py-3 text-right">Profit</th>
              <th className="px-5 py-3 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-slate-950 hover:text-teal-700">
                    {job.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{job.customerName}</p>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-5 py-4 text-right">{formatCurrency(job.actualRevenue)}</td>
                <td className="px-5 py-4 text-right">{formatCurrency(job.cashCollected)}</td>
                <td className="px-5 py-4 text-right">{formatCurrency(job.totalCosts)}</td>
                <td className="px-5 py-4 text-right font-semibold">{formatCurrency(job.grossProfit)}</td>
                <td className="px-5 py-4 text-right">
                  <span className={job.margin < 0.2 ? "font-semibold text-rose-700" : "font-semibold text-teal-700"}>
                    {formatPercent(job.margin)}
                  </span>
                </td>
              </tr>
            ))}
            {!jobs.length ? (
              <tr>
                <td className="px-5 py-10 text-center text-slate-500" colSpan={7}>
                  No jobs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
