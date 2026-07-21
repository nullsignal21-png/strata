"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Filter, Loader2, Trash2 } from "lucide-react";
import { CATEGORIES, categoriesForDirection } from "@/lib/categories";
import { formatCurrencyPrecise, formatDate } from "@/lib/format";
import type { JobFinancial, TransactionRow } from "@/lib/metrics";
import { CategoryBadge } from "@/components/CategoryBadge";
import { StatusBadge } from "@/components/StatusBadge";

type Props = {
  initialTransactions: TransactionRow[];
  jobs: Pick<JobFinancial, "id" | "name">[];
};

function uniqueOptions(rows: TransactionRow[], field: "uploadBatchId" | "aiCategory") {
  return Array.from(new Set(rows.map((row) => row[field]).filter(Boolean))) as string[];
}

export function TransactionTable({ initialTransactions, jobs }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    query: "",
    direction: "all",
    category: "all",
    job: "all",
    status: "all",
    uploadBatch: "all",
    startDate: "",
    endDate: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const uploadBatchOptions = useMemo(() => uniqueOptions(transactions, "uploadBatchId"), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      const queryMatch =
        !filters.query ||
        `${transaction.merchant} ${transaction.description} ${transaction.jobName ?? ""}`
          .toLowerCase()
          .includes(filters.query.toLowerCase());
      const directionMatch = filters.direction === "all" || transaction.direction === filters.direction;
      const categoryMatch = filters.category === "all" || transaction.aiCategory === filters.category;
      const jobMatch =
        filters.job === "all" || (filters.job === "unassigned" ? !transaction.jobId : transaction.jobId === filters.job);
      const statusMatch = filters.status === "all" || transaction.status === filters.status;
      const uploadMatch = filters.uploadBatch === "all" || transaction.uploadBatchId === filters.uploadBatch;
      const day = transaction.date.slice(0, 10);
      const startMatch = !filters.startDate || day >= filters.startDate;
      const endMatch = !filters.endDate || day <= filters.endDate;

      return queryMatch && directionMatch && categoryMatch && jobMatch && statusMatch && uploadMatch && startMatch && endMatch;
    });
  }, [filters, transactions]);

  const visibleRows = filtered.slice(0, 100);
  const selectedRows = transactions.filter((transaction) => selectedIds.includes(transaction.id));
  const sharedSuggestedJob = Array.from(new Set(selectedRows.map((row) => row.suggestedJobId).filter(Boolean)));
  const canBulkAssign = sharedSuggestedJob.length === 1;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function reloadTransactions() {
    const response = await fetch("/api/transactions");
    const data = await response.json();
    if (response.ok) setTransactions(data.transactions);
  }

  async function updateTransaction(id: string, patch: Partial<TransactionRow>) {
    setSavingId(id);
    setMessage(null);
    try {
      const response = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update failed.");
      setTransactions((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                ...data.transaction,
                suggestedJobName: data.transaction.suggestedJobName ?? row.suggestedJobName,
              }
            : row,
        ),
      );
      setMessage("Transaction updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    setSavingId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      setTransactions((current) => current.filter((row) => row.id !== id));
      setSelectedIds((current) => current.filter((value) => value !== id));
      setMessage("Transaction deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function runBulk(action: "mark_reviewed" | "categorize" | "assign_suggested") {
    setBulkAction(action);
    setMessage(null);
    try {
      const response = await fetch("/api/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bulk action failed.");
      await reloadTransactions();
      setSelectedIds([]);
      setMessage(`Updated ${data.updatedCount} transactions.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkAction(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-lg font-semibold">Transaction review</h2>
              <p className="mt-1 text-sm text-slate-500">Change direction, category, job, and review status.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedIds.length || bulkAction !== null}
                title={!selectedIds.length ? "Select transactions first." : "Mark selected transactions reviewed."}
                onClick={() => runBulk("mark_reviewed")}
                className="focus-ring inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {bulkAction === "mark_reviewed" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Bulk review
              </button>
              <button
                type="button"
                disabled={!selectedIds.length || bulkAction !== null}
                title={!selectedIds.length ? "Select transactions first." : "Run deterministic categorization on selected transactions."}
                onClick={() => runBulk("categorize")}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Bulk categorize
              </button>
              <button
                type="button"
                disabled={!selectedIds.length || !canBulkAssign || bulkAction !== null}
                title={canBulkAssign ? "Assign selected rows to their shared suggested job." : "Select rows that share one suggested job."}
                onClick={() => runBulk("assign_suggested")}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Bulk assign suggestion
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 xl:col-span-2">
              Search
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Merchant, description, or job"
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              />
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Direction
              <select value={filters.direction} onChange={(event) => updateFilter("direction", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal">
                <option value="all">All</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Category
              <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal">
                <option value="all">All</option>
                {CATEGORIES.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Job
              <select value={filters.job} onChange={(event) => updateFilter("job", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal">
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {jobs.map((job) => (
                  <option value={job.id} key={job.id}>{job.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Review
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal">
                <option value="all">All</option>
                <option value="needs_review">Needs review</option>
                <option value="reviewed">Reviewed</option>
                <option value="categorized">Categorized</option>
                <option value="imported">Imported</option>
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Upload
              <select value={filters.uploadBatch} onChange={(event) => updateFilter("uploadBatch", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal">
                <option value="all">All</option>
                {uploadBatchOptions.map((id) => {
                  const batch = transactions.find((row) => row.uploadBatchId === id);
                  return <option value={id} key={id}>{batch?.uploadBatchFilename ?? id}</option>;
                })}
              </select>
            </label>
            <div className="flex items-end">
              <div className="inline-flex w-full items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                <Filter size={16} />
                {filtered.length} rows
              </div>
            </div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              From
              <input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal" />
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              To
              <input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal" />
            </label>
          </div>
          {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">
                <input
                  aria-label="Select visible transactions"
                  type="checkbox"
                  checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))}
                  onChange={(event) =>
                    setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...visibleRows.map((row) => row.id)])) : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))
                  }
                />
              </th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Merchant / description</th>
              <th className="px-5 py-3">Direction</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Assigned job</th>
              <th className="px-5 py-3">Suggested</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((transaction) => (
              <tr key={transaction.id} className="align-top hover:bg-slate-50">
                <td className="px-5 py-4">
                  <input aria-label={`Select ${transaction.merchant}`} type="checkbox" checked={selectedIds.includes(transaction.id)} onChange={() => toggleSelected(transaction.id)} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap">{formatDate(transaction.date)}</td>
                <td className="px-5 py-4">
                  <p className="font-medium">{transaction.merchant}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{transaction.description}</p>
                </td>
                <td className="px-5 py-4">
                  <select value={transaction.direction} onChange={(event) => updateTransaction(transaction.id, { direction: event.target.value as "income" | "expense" })} className="focus-ring w-28 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">{formatCurrencyPrecise(transaction.amount)}</td>
                <td className="px-5 py-4">
                  <select value={transaction.aiCategory} onChange={(event) => updateTransaction(transaction.id, { aiCategory: event.target.value })} className="focus-ring w-48 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
                    {categoriesForDirection(transaction.direction).map((category) => (
                      <option value={category} key={category}>{category}</option>
                    ))}
                  </select>
                  <div className="mt-2"><CategoryBadge category={transaction.aiCategory} /></div>
                </td>
                <td className="px-5 py-4">
                  <select value={transaction.jobId ?? "unassigned"} onChange={(event) => updateTransaction(transaction.id, { jobId: event.target.value === "unassigned" ? null : event.target.value })} className="focus-ring w-56 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
                    <option value="unassigned">Unassigned</option>
                    {jobs.map((job) => (
                      <option value={job.id} key={job.id}>{job.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4 text-xs text-slate-500">
                  {transaction.suggestedJobName ? (
                    <>
                      <p className="font-medium text-slate-700">{transaction.suggestedJobName}</p>
                      <p>{Math.round(transaction.matchConfidence * 100)}% - {transaction.matchReason}</p>
                    </>
                  ) : "None"}
                </td>
                <td className="px-5 py-4"><StatusBadge status={transaction.status} /></td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={savingId === transaction.id} onClick={() => updateTransaction(transaction.id, { status: "reviewed" })} className="focus-ring inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300">
                      <CheckCircle2 size={15} />
                      Review
                    </button>
                    <button type="button" disabled={savingId === transaction.id} onClick={() => deleteTransaction(transaction.id)} className="focus-ring inline-flex rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:text-slate-300" title="Delete transaction">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visibleRows.length ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-slate-500">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {filtered.length > visibleRows.length ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            Showing first {visibleRows.length} matching rows. Narrow filters to inspect more.
          </p>
        ) : null}
      </div>
    </div>
  );
}
