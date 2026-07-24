import { TransactionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { categorizeExistingTransactions } from "@/lib/importTransactions";
import { logger } from "@/lib/logging";
import { getDemoCompany } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { bulkTransactionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = bulkTransactionSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk transaction request.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Demo company is absent." }, { status: 400 });
  }

  if (parsed.data.action === "categorize") {
    const result = await categorizeExistingTransactions(company.id, parsed.data.ids);
    return NextResponse.json(result);
  }

  const prisma = getPrisma();
  const transactions = await prisma.transaction.findMany({
    where: { companyId: company.id, id: { in: parsed.data.ids } },
    select: { id: true, suggestedJobId: true },
  });

  if (transactions.length !== parsed.data.ids.length) {
    return NextResponse.json({ error: "One or more transactions were not found." }, { status: 404 });
  }

  if (parsed.data.action === "mark_reviewed") {
    const result = await prisma.transaction.updateMany({
      where: { companyId: company.id, id: { in: parsed.data.ids } },
      data: { status: TransactionStatus.reviewed, confidence: 1 },
    });
    return NextResponse.json({ updatedCount: result.count });
  }

  const suggestedJobIds = Array.from(new Set(transactions.map((transaction) => transaction.suggestedJobId).filter(Boolean)));
  if (suggestedJobIds.length !== 1) {
    return NextResponse.json({ error: "Selected transactions do not share the same suggested job." }, { status: 409 });
  }

  const result = await prisma.transaction.updateMany({
    where: { companyId: company.id, id: { in: parsed.data.ids } },
    data: { jobId: suggestedJobIds[0], status: TransactionStatus.reviewed, matchConfidence: 1 },
  });

  logger.info("job_matching_completed", { companyId: company.id, updatedCount: result.count });
  return NextResponse.json({ updatedCount: result.count, jobId: suggestedJobIds[0] });
}
