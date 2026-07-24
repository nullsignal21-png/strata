import { NextResponse } from "next/server";
import { categorizeExistingTransactions } from "@/lib/importTransactions";
import { getDemoCompany } from "@/lib/metrics";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before categorizing transactions." }, { status: 400 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = z
    .object({ transactionIds: z.array(z.string().min(8)).max(200).optional() })
    .safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid categorization request.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await categorizeExistingTransactions(company.id, parsed.data.transactionIds);

  return NextResponse.json(result);
}
