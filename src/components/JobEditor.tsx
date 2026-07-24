"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import type { JobFinancial } from "@/lib/metrics";

export function JobEditor({ job }: { job: JobFinancial }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update job.");
      setMessage("Job updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update job.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteJob() {
    if (!window.confirm("Delete this job? Its transactions will become unassigned.")) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete job.");
      router.push("/jobs");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete job.");
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Edit job</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input aria-label="Job name" name="name" defaultValue={job.name} required className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <input aria-label="Customer name" name="customerName" defaultValue={job.customerName} required className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <input aria-label="Trade type" name="tradeType" defaultValue={job.tradeType} required className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <select aria-label="Job status" name="status" defaultValue={job.status} className="focus-ring rounded-md border border-slate-300 px-3 py-2">
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <input aria-label="City" name="city" defaultValue={job.city ?? ""} placeholder="City" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <input aria-label="Address" name="address" defaultValue={job.address ?? ""} placeholder="Address" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <input aria-label="Estimated revenue" name="estimatedRevenue" defaultValue={job.estimatedRevenue} type="number" min="0" step="0.01" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <input aria-label="Actual revenue" name="actualRevenue" defaultValue={job.actualRevenue} type="number" min="0" step="0.01" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        <label className="text-xs font-medium text-slate-600">
          Start date
          <input
            name="startDate"
            defaultValue={job.startDate?.slice(0, 10) ?? ""}
            type="date"
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          End date
          <input
            name="endDate"
            defaultValue={job.endDate?.slice(0, 10) ?? ""}
            type="date"
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button disabled={isSaving} className="focus-ring inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300">
          <Save size={16} />
          Save
        </button>
        <button type="button" disabled={isSaving} onClick={deleteJob} className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:text-slate-300">
          <Trash2 size={16} />
          Delete
        </button>
        {message ? <span aria-live="polite" className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}
