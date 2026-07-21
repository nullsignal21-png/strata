import type { JobFinancial } from "@/lib/metrics";
import { formatCurrency, formatPercent } from "@/lib/format";

export function ProfitChart({ jobs }: { jobs: JobFinancial[] }) {
  const maxProfit = Math.max(...jobs.map((job) => Math.max(job.grossProfit, 0)), 1);

  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Profit by job</h2>
          <p className="mt-1 text-sm text-slate-500">Fast visual check for margin pressure.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        {jobs.length ? jobs.map((job) => (
          <div key={job.id}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{job.name}</span>
              <span className="shrink-0 text-slate-500">
                {formatCurrency(job.grossProfit)} / {formatPercent(job.margin)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={job.margin < 0.2 ? "h-full rounded-full bg-rose-500" : "h-full rounded-full bg-teal-500"}
                style={{ width: `${Math.max(6, (Math.max(job.grossProfit, 0) / maxProfit) * 100)}%` }}
              />
            </div>
          </div>
        )) : (
          <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">No job profitability data yet.</p>
        )}
      </div>
    </div>
  );
}
