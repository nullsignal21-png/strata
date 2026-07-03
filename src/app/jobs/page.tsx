import { AppShell } from "@/components/AppShell";
import { CreateJobForm } from "@/components/CreateJobForm";
import { JobProfitTable } from "@/components/JobProfitTable";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { getCompanyOrNull, getJobsWithFinancials } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const company = await getCompanyOrNull();
  const jobs = company ? await getJobsWithFinancials(company.id) : [];

  return (
    <AppShell>
      {!company ? (
        <SetupEmptyState />
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Job costing</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">Jobs</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                View demo jobs or create a new one for imported transactions to match against.
              </p>
            </div>
            <CreateJobForm />
          </div>
          <JobProfitTable jobs={jobs} />
        </div>
      )}
    </AppShell>
  );
}
