import { NextResponse } from "next/server";
import { parseTransactionCsv } from "@/lib/csv";
import { importParsedTransactions } from "@/lib/importTransactions";
import { getDemoCompany } from "@/lib/metrics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const isPreview = form.get("preview") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A CSV file is required." }, { status: 400 });
  }

  const csvText = await file.text();
  const parsed = parseTransactionCsv(csvText);

  if (isPreview) {
    return NextResponse.json({
      preview: parsed.transactions.slice(0, 50),
      errors: parsed.errors.slice(0, 10),
      skippedRows: parsed.skippedRows,
    });
  }

  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before importing transactions." }, { status: 400 });
  }

  if (!parsed.transactions.length) {
    return NextResponse.json({ error: "No valid transactions found.", errors: parsed.errors }, { status: 400 });
  }

  const result = await importParsedTransactions({
    companyId: company.id,
    filename: file.name,
    transactions: parsed.transactions,
  });

  return NextResponse.json({ ...result, errors: parsed.errors, skippedRows: parsed.skippedRows });
}
