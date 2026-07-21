import { NextResponse } from "next/server";
import { categorizeExistingTransactions } from "@/lib/importTransactions";
import { getDemoCompany } from "@/lib/metrics";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before categorizing transactions." }, { status: 400 });
  }

  const parsed = z
    .object({ transactionIds: z.array(z.string().min(8)).optional() })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid categorization request.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await categorizeExistingTransactions(company.id, parsed.data.transactionIds);

  return NextResponse.json(result);
}
