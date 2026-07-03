"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Filter, Pencil } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { formatCurrencyPrecise, formatDate } from "@/lib/format";
import type { JobFinancial, TransactionRow } from "@/lib/metrics";
import { CategoryBadge } from "@/components/CategoryBadge";
import { StatusBadge } from "@/components/StatusBadge";

type Props = {
  initialTransactions: TransactionRow[];
  jobs: Pick<JobFinancial, "id" | "name">[];
};

export function TransactionTable({ initialTransactions, jobs }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "unassigned" && !transaction.jobId) ||
        (statusFilter === "low_confidence" && transaction.confidence < 0.75) ||
        transaction.status === statusFilter;
      const categoryMatch = categoryFilter === "all" || transaction.aiCategory === categoryFilter;
      const jobMatch = jobFilter === "all" || (jobFilter === "unassigned" ? !transaction.jobId : transaction.jobId === jobFilter);
      const queryMatch =
        !query ||
        `${transaction.merchant} ${transaction.description} ${transaction.jobName ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());

      return statusMatch && categoryMatch && jobMatch && queryMatch;
    });
  }, [categoryFilter, jobFilter, query, statusFilter, transactions]);

  async function updateTransaction(id: string, patch: Partial<TransactionRow>) {
    setSavingId(id);
    try {
      const response = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update failed.");
      setTransactions((current) => current.map((row) => (row.id === id ? data.transaction : row)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Transaction review</h2>
            <p className="mt-1 text-sm text-slate-500">Change category, assign a job, and mark reviewed.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Merchant or job"
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              />
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="low_confidence">Low confidence</option>
                <option value="needs_review">Needs review</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Category
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              >
                <option value="all">All</option>
                {CATEGORIES.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Job
              <select
                value={jobFilter}
                onChange={(event) => setJobFilter(event.target.value)}
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {jobs.map((job) => (
                  <option value={job.id} key={job.id}>
                    {job.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                <Filter size={16} />
                {filtered.length} rows
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Merchant / description</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3">AI category</th>
              <th className="px-5 py-3">Assigned job</th>
              <th className="px-5 py-3">Confidence</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="align-top hover:bg-slate-50">
                <td className="px-5 py-4 whitespace-nowrap">{formatDate(transaction.date)}</td>
                <td className="px-5 py-4">
                  <p className="font-medium">{transaction.merchant}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{transaction.description}</p>
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">{formatCurrencyPrecise(transaction.amount)}</td>
                <td className="px-5 py-4">
                  <select
                    value={transaction.aiCategory}
                    onChange={(event) => updateTransaction(transaction.id, { aiCategory: event.target.value })}
                    className="focus-ring w-44 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    {CATEGORIES.map((category) => (
                      <option value={category} key={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <CategoryBadge category={transaction.aiCategory} />
                  </div>
                </td>
                <td className="px-5 py-4">
                  <select
                    value={transaction.jobId ?? "unassigned"}
                    onChange={(event) =>
                      updateTransaction(transaction.id, {
                        jobId: event.target.value === "unassigned" ? null : event.target.value,
                      })
                    }
                    className="focus-ring w-56 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    <option value="unassigned">Unassigned</option>
                    {jobs.map((job) => (
                      <option value={job.id} key={job.id}>
                        {job.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4">{Math.round(transaction.confidence * 100)}%</td>
                <td className="px-5 py-4">
                  <StatusBadge status={transaction.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      title="Edit transaction"
                      className="focus-ring inline-flex rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={savingId === transaction.id}
                      onClick={() => updateTransaction(transaction.id, { status: "reviewed" })}
                      className="focus-ring inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
                    >
                      <CheckCircle2 size={15} />
                      Review
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
