import { AppShell } from "@/components/AppShell";
import { UploadCsvCard } from "@/components/UploadCsvCard";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">CSV import</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Upload transactions</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Upload messy bank or credit card exports. Strata normalizes costs, categorizes spend, and assigns likely jobs.
          </p>
        </div>
        <UploadCsvCard />
      </div>
    </AppShell>
  );
}
