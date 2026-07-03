import { NextResponse } from "next/server";
import { categorizeExistingTransactions } from "@/lib/importTransactions";
import { getDemoCompany } from "@/lib/metrics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before categorizing transactions." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const transactionIds = Array.isArray(body.transactionIds) ? body.transactionIds.filter(Boolean) : undefined;
  const result = await categorizeExistingTransactions(company.id, transactionIds);

  return NextResponse.json(result);
}
