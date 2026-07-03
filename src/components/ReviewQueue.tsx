import Link from "next/link";
import type { JobFinancial } from "@/lib/metrics";
import { formatPercent } from "@/lib/format";

export function ReviewQueue({ jobs }: { jobs: JobFinancial[] }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Jobs at risk</h2>
          <p className="mt-1 text-sm text-slate-500">Margin below 20% needs attention.</p>
        </div>
        <Link href="/transactions" className="text-sm font-semibold text-teal-700 hover:text-teal-900">
          Review transactions
        </Link>
      </div>
      <div className="mt-5 grid gap-3">
        {jobs.length === 0 ? (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            No low-margin jobs in the current demo data.
          </p>
        ) : (
          jobs.map((job) => (
            <Link
              href={`/jobs/${job.id}`}
              key={job.id}
              className="rounded-md border border-rose-100 bg-rose-50 px-4 py-3 transition hover:border-rose-200"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-rose-950">{job.name}</p>
                <span className="font-semibold text-rose-700">{formatPercent(job.margin)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
