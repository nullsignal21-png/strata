"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, UploadCloud } from "lucide-react";
import { formatCurrencyPrecise } from "@/lib/format";
import type { SignedAmountConvention } from "@/lib/csv";

type PreviewRow = {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: "income" | "expense";
  rawCategory: string | null;
  duplicate: boolean;
};

type PreviewData = {
  mappedColumns: Record<string, string | null>;
  detectedSignConvention: SignedAmountConvention;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateCount: number;
  skippedRows: number;
  incomeTotal: number;
  expenseTotal: number;
  preview: PreviewRow[];
  errors: string[];
};

export function UploadCsvCard() {
  const [file, setFile] = useState<File | null>(null);
  const [signConvention, setSignConvention] = useState<SignedAmountConvention>("negative_expense");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const canImport = file && preview && preview.validRowCount > 0 && !isImporting;

  async function previewFile(nextFile = file, nextConvention = signConvention) {
    setPreview(null);
    setMessage(null);
    if (!nextFile) return;

    setIsParsing(true);
    try {
      const form = new FormData();
      form.append("file", nextFile);
      form.append("preview", "true");
      form.append("signedAmountConvention", nextConvention);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not parse CSV.");
      setPreview(data);
      setMessage(`Previewed ${data.validRowCount} importable rows from ${data.totalRows} data rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse CSV.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleFile(nextFile: File | null) {
    setFile(nextFile);
    await previewFile(nextFile);
  }

  async function updateConvention(nextConvention: SignedAmountConvention) {
    setSignConvention(nextConvention);
    await previewFile(file, nextConvention);
  }

  async function importCsv() {
    if (!file) return;
    setIsImporting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("signedAmountConvention", signConvention);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed.");
      setMessage(`Imported ${data.importedCount} transactions, skipped ${data.skippedCount}.`);
      setPreview(null);
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
              Demo limit: .csv only, 2 MB, 1,000 data rows. Raw CSV files are parsed and discarded.
            </p>
          </div>
        </div>

        <a
          href="/sample-transactions.csv"
          download
          className="focus-ring mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Download size={16} />
          Download sample CSV
        </a>

        <fieldset className="mt-5 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sign convention</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={signConvention === "negative_expense"}
              onChange={() => updateConvention("negative_expense")}
            />
            Negative values are expenses
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={signConvention === "positive_expense"}
              onChange={() => updateConvention("positive_expense")}
            />
            Positive values are expenses
          </label>
        </fieldset>

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
        {preview?.errors.length ? (
          <div className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Skipped and invalid rows</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {preview.errors.slice(0, 5).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isParsing
              ? "Parsing CSV..."
              : preview
                ? `${preview.validRowCount} valid, ${preview.invalidRowCount} invalid, ${preview.duplicateCount} duplicate`
                : "Select a CSV to preview transactions before import."}
          </p>
          {preview ? (
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md bg-slate-50 px-3 py-2">Income {formatCurrencyPrecise(preview.incomeTotal)}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Expenses {formatCurrencyPrecise(preview.expenseTotal)}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Rows {preview.totalRows}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Skipped {preview.skippedRows}</div>
            </div>
          ) : null}
        </div>
        {preview ? (
          <div className="border-b border-black/10 px-5 py-3 text-xs text-slate-600">
            {Object.entries(preview.mappedColumns)
              .filter(([, value]) => value)
              .map(([field, value]) => `${field}: ${value}`)
              .join(" | ")}
          </div>
        ) : null}
        <div className="max-h-[540px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Merchant / description</th>
                <th className="px-5 py-3">Direction</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview?.preview.map((row, index) => (
                <tr key={`${row.date}-${row.description}-${index}`} className={row.duplicate ? "bg-amber-50" : undefined}>
                  <td className="px-5 py-4">{row.date}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="mt-1 max-w-xl truncate text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="px-5 py-4 capitalize">{row.direction}</td>
                  <td className="px-5 py-4 text-right">{formatCurrencyPrecise(row.amount)}</td>
                  <td className="px-5 py-4 text-slate-500">{row.duplicate ? "Duplicate" : row.rawCategory ?? "Ready"}</td>
                </tr>
              ))}
              {!preview && !isParsing ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={5}>
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
