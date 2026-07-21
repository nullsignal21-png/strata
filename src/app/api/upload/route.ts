import { NextResponse } from "next/server";
import { CSV_LIMITS, parseTransactionCsv } from "@/lib/csv";
import { findExistingFingerprints, importParsedTransactions } from "@/lib/importTransactions";
import { logger } from "@/lib/logging";
import { getDemoCompany } from "@/lib/metrics";
import { uploadOptionsSchema } from "@/lib/validation";

export const runtime = "nodejs";

function validCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const options = uploadOptionsSchema.safeParse({
    preview: form.get("preview") === "true",
    signedAmountConvention: form.get("signedAmountConvention") || undefined,
  });

  if (!options.success) {
    return NextResponse.json({ error: "Invalid upload options.", issues: options.error.flatten() }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A CSV file is required." }, { status: 400 });
  }

  if (!validCsvFile(file)) {
    logger.warn("upload_rejected", { reason: "file_type", filename: file.name });
    return NextResponse.json({ error: "Only .csv files are supported." }, { status: 400 });
  }

  if (file.size > CSV_LIMITS.maxBytes) {
    logger.warn("upload_rejected", { reason: "file_size", filename: file.name, size: file.size });
    return NextResponse.json({ error: "The demo accepts CSV files up to 2 MB." }, { status: 400 });
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
  });
  const existingFingerprints = await findExistingFingerprints(
    company.id,
    parsed.transactions.map((transaction) => transaction.fingerprint),
  );
  const crossUploadDuplicateCount = existingFingerprints.size;

  if (options.data.preview) {
    return NextResponse.json({
      mappedColumns: parsed.mappedColumns,
      detectedSignConvention: parsed.signConvention,
      totalRows: parsed.totalRows,
      validRowCount: parsed.validRowCount - crossUploadDuplicateCount,
      invalidRowCount: parsed.invalidRowCount,
      duplicateCount: parsed.duplicateCount + crossUploadDuplicateCount,
      incomeTotal: parsed.incomeTotal,
      expenseTotal: parsed.expenseTotal,
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

  const result = await importParsedTransactions({
    companyId: company.id,
    filename: file.name,
    transactions: parsed.transactions,
    totalRows: parsed.totalRows,
    invalidCount: parsed.invalidRowCount,
    duplicateCount: parsed.duplicateCount,
    incomeTotal: parsed.incomeTotal,
    expenseTotal: parsed.expenseTotal,
  });

  return NextResponse.json({ ...result, errors: parsed.errors, skippedRows: result.skippedCount });
}
