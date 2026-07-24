import { AppShell } from "@/components/AppShell";
import { DashboardCards } from "@/components/DashboardCards";
import { JobProfitTable } from "@/components/JobProfitTable";
import { ProfitChart } from "@/components/ProfitChart";
import { ReviewQueue } from "@/components/ReviewQueue";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { getDashboardMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <AppShell>
      {metrics.state !== "ready" ? (
        <SetupEmptyState message={metrics.message} showCommands={metrics.state !== "database_unavailable"} />
      ) : (
        <div className="grid grid-cols-1 gap-7">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{metrics.company.name}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 lg:text-4xl">
                Job profitability dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Built for contractors who use QuickBooks but still track job costs manually.
              </p>
            </div>
          </div>

          <DashboardCards
            totalRevenue={metrics.totalRevenue}
            totalJobCosts={metrics.totalJobCosts}
            grossProfit={metrics.grossProfit}
            averageMargin={metrics.averageMargin}
            cashCollected={metrics.cashCollected}
            uncategorizedCount={metrics.uncategorizedCount}
            unassignedCount={metrics.unassignedCount}
            needsReviewCount={metrics.needsReviewCount}
          />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <ProfitChart jobs={metrics.topJobs} />
            <ReviewQueue jobs={metrics.atRiskJobs} />
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Recent uploads</h2>
            <div className="mt-4 grid gap-3">
              {metrics.uploadBatches.map((batch) => (
                <div key={batch.id} className="flex flex-col justify-between gap-2 rounded-md bg-slate-50 px-4 py-3 sm:flex-row">
                  <span className="font-medium">{batch.filename}</span>
                  <span className="text-sm text-slate-600">
                    {batch.importedCount} imported, {batch.duplicateCount} duplicates, {batch.invalidCount} invalid
                  </span>
                </div>
              ))}
            </div>
          </div>

          <JobProfitTable jobs={metrics.topJobs} title="Top 5 jobs by profit" />
        </div>
      )}
    </AppShell>
  );
}
