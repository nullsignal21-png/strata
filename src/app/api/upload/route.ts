import { NextResponse } from "next/server";
import { CSV_LIMITS, parseTransactionCsv } from "@/lib/csv";
import {
  findExistingFingerprints,
  importParsedTransactions,
  NoNewTransactionsError,
} from "@/lib/importTransactions";
import { logger } from "@/lib/logging";
import { getDemoCompany } from "@/lib/metrics";
import { rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { uploadOptionsSchema } from "@/lib/validation";

export const runtime = "nodejs";

function validCsvFile(file: File) {
  const allowedTypes = new Set(["", "text/csv", "text/plain", "application/vnd.ms-excel"]);
  return file.name.toLowerCase().endsWith(".csv") && allowedTypes.has(file.type.toLowerCase());
}

function validFilename(filename: string) {
  return filename.length <= 200 &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("..") &&
    !/[\u0000-\u001f\u007f]/.test(filename);
}

function parseMapping(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > CSV_LIMITS.maxBytes + 64 * 1024) {
    return NextResponse.json({ error: "The demo accepts CSV files up to 2 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload must be valid multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  const options = uploadOptionsSchema.safeParse({
    preview: form.get("preview") === "true",
    signedAmountConvention: form.get("signedAmountConvention") || undefined,
    columnMapping: parseMapping(form.get("columnMapping")),
  });

  if (!options.success) {
    return NextResponse.json({ error: "Invalid upload options.", issues: options.error.flatten() }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A CSV file is required." }, { status: 400 });
  }

  if (!validFilename(file.name)) {
    logger.warn("upload_rejected", { reason: "filename" });
    return NextResponse.json({ error: "CSV filename is invalid." }, { status: 400 });
  }

  if (!validCsvFile(file)) {
    logger.warn("upload_rejected", { reason: "file_type", filename: file.name });
    return NextResponse.json({ error: "Only .csv files are supported." }, { status: 400 });
  }

  if (file.size > CSV_LIMITS.maxBytes) {
    logger.warn("upload_rejected", { reason: "file_size", filename: file.name, size: file.size });
    return NextResponse.json({ error: "The demo accepts CSV files up to 2 MB." }, { status: 413 });
  }

  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json(
      { error: "Database is reachable, but the demo company is absent. Run the seed or enable DEMO_MODE." },
      { status: 400 },
    );
  }

  const csvText = await file.text();
  const parsed = parseTransactionCsv(csvText, {
    companyId: company.id,
    signedAmountConvention: options.data.signedAmountConvention,
    columnMapping: options.data.columnMapping,
  });
  if (parsed.totalRows > CSV_LIMITS.maxRows) {
    return NextResponse.json(
      {
        error: `CSV has ${parsed.totalRows.toLocaleString("en-US")} data rows. The demo limit is ${CSV_LIMITS.maxRows.toLocaleString("en-US")} rows.`,
      },
      { status: 413 },
    );
  }
  const existingFingerprints = await findExistingFingerprints(
    company.id,
    parsed.transactions.map((transaction) => transaction.fingerprint),
  );
  const crossUploadDuplicateCount = existingFingerprints.size;
  const importableTransactions = parsed.transactions.filter(
    (transaction) => !existingFingerprints.has(transaction.fingerprint),
  );
  const previewTotals = importableTransactions.reduce(
    (totals, transaction) => {
      totals[transaction.direction] += transaction.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );

  if (options.data.preview) {
    return NextResponse.json({
      headers: parsed.headers,
      mappedColumns: parsed.mappedColumns,
      detectedSignConvention: parsed.signConvention,
      totalRows: parsed.totalRows,
      validRowCount: parsed.validRowCount - crossUploadDuplicateCount,
      invalidRowCount: parsed.invalidRowCount,
      duplicateCount: parsed.duplicateCount + crossUploadDuplicateCount,
      incomeTotal: Math.round(previewTotals.income * 100) / 100,
      expenseTotal: Math.round(previewTotals.expense * 100) / 100,
      preview: parsed.transactions.slice(0, 10).map((transaction) => ({
        ...transaction,
        duplicate: existingFingerprints.has(transaction.fingerprint),
      })),
      errors: parsed.errors.slice(0, 10),
      skippedRows: parsed.skippedRows + crossUploadDuplicateCount,
    });
  }

  if (!parsed.transactions.length || parsed.validRowCount === crossUploadDuplicateCount) {
    return NextResponse.json(
      { error: "No new valid transactions found.", errors: parsed.errors, duplicateCount: parsed.duplicateCount + crossUploadDuplicateCount },
      { status: 409 },
    );
  }

  let result;
  try {
    result = await importParsedTransactions({
      companyId: company.id,
      filename: file.name,
      transactions: parsed.transactions,
      totalRows: parsed.totalRows,
      invalidCount: parsed.invalidRowCount,
      duplicateCount: parsed.duplicateCount,
      incomeTotal: parsed.incomeTotal,
      expenseTotal: parsed.expenseTotal,
    });
  } catch (error) {
    if (error instanceof NoNewTransactionsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ...result, errors: parsed.errors, skippedRows: result.skippedCount });
}
