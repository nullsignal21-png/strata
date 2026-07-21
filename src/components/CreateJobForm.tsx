"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function CreateJobForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create job.");
      setIsOpen(false);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create job.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="focus-ring inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <Plus size={17} />
        Create job
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:grid-cols-6">
      <input name="name" required placeholder="Job name" className="focus-ring rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" />
      <input name="customerName" required placeholder="Customer" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
      <select name="tradeType" className="focus-ring rounded-md border border-slate-300 px-3 py-2">
        <option>HVAC</option>
        <option>Plumbing</option>
        <option>Electrical</option>
      </select>
      <input name="city" placeholder="City" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
      <input name="address" placeholder="Address" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
      <select name="status" className="focus-ring rounded-md border border-slate-300 px-3 py-2">
        <option value="active">Active</option>
        <option value="planned">Planned</option>
        <option value="completed">Completed</option>
      </select>
      <input name="estimatedRevenue" required type="number" min="0" step="0.01" placeholder="Estimated revenue" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
      <input name="actualRevenue" required type="number" min="0" step="0.01" placeholder="Actual revenue" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
      <div className="flex items-center gap-2 lg:col-span-6">
        <button disabled={isSaving} className="focus-ring rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300">
          Save job
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className="focus-ring rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        {error ? <span className="text-sm text-rose-700">{error}</span> : null}
      </div>
    </form>
  );
}
