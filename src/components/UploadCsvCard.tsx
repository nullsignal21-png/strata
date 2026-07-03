"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { formatCurrencyPrecise } from "@/lib/format";

type PreviewRow = {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  rawCategory: string | null;
};

export function UploadCsvCard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const canImport = file && preview.length > 0 && !isImporting;
  const previewTotal = useMemo(() => preview.reduce((sum, row) => sum + row.amount, 0), [preview]);

  async function handleFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview([]);
    setMessage(null);
    setErrors([]);
    if (!nextFile) return;

    setIsParsing(true);
    try {
      const form = new FormData();
      form.append("file", nextFile);
      form.append("preview", "true");
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not parse CSV.");
      setPreview(data.preview);
      setErrors(data.errors ?? []);
      setMessage(`Previewed ${data.preview.length} importable rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse CSV.");
    } finally {
      setIsParsing(false);
    }
  }

  async function importCsv() {
    if (!file) return;
    setIsImporting(true);
    setMessage(null);
    setErrors([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed.");
      setMessage(
        `Imported ${data.importedCount} transactions, skipped ${data.skippedCount}, and categorized the batch.`,
      );
      setPreview([]);
      setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-teal-50 p-2 text-teal-700">
            <UploadCloud size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Upload bank or card CSV</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Strata maps common headers like date, merchant, description, amount, category, debit, and credit.
            </p>
          </div>
        </div>

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition hover:border-teal-400 hover:bg-teal-50/40">
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <UploadCloud className="text-slate-500" size={30} />
          <span className="mt-3 font-medium">{file ? file.name : "Choose a CSV file"}</span>
          <span className="mt-1 text-sm text-slate-500">Preview first, then import and categorize.</span>
        </label>

        <button
          type="button"
          disabled={!canImport}
          onClick={importCsv}
          className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isImporting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          Import and Categorize
        </button>

        {message ? <p className="mt-4 rounded-md bg-teal-50 px-4 py-3 text-sm text-teal-800">{message}</p> : null}
        {errors.length > 0 ? (
          <div className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">CSV notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.slice(0, 4).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isParsing ? "Parsing CSV..." : `${preview.length} rows / ${formatCurrencyPrecise(previewTotal)} total costs`}
            </p>
          </div>
        </div>
        <div className="max-h-[540px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Merchant / description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Raw category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.slice(0, 20).map((row, index) => (
                <tr key={`${row.date}-${row.description}-${index}`}>
                  <td className="px-5 py-4">{row.date}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="mt-1 max-w-xl truncate text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="px-5 py-4 text-right">{formatCurrencyPrecise(row.amount)}</td>
                  <td className="px-5 py-4 text-slate-500">{row.rawCategory ?? "None"}</td>
                </tr>
              ))}
              {!preview.length && !isParsing ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={4}>
                    Select a CSV to preview transactions before import.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
