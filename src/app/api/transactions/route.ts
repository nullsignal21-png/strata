import { TransactionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { categoriesForDirection, defaultCategoryForDirection } from "@/lib/categories";
import { getDemoCompany, getTransactions } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { transactionPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const transactions = await getTransactions();
  return NextResponse.json({ transactions });
}

export async function PATCH(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = transactionPatchSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction update.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Demo company is absent." }, { status: 400 });
  }
  const current = await prisma.transaction.findFirst({
    where: { id: parsed.data.id, companyId: company.id },
    include: { job: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const direction = parsed.data.direction ?? current.direction;
  const data = {
    aiCategory: parsed.data.aiCategory,
    jobId: parsed.data.jobId,
    direction: parsed.data.direction,
    status: parsed.data.status,
    confidence: undefined as number | undefined,
  };

  if (parsed.data.aiCategory) {
    if (!categoriesForDirection(direction).some((category) => category === parsed.data.aiCategory)) {
      return NextResponse.json({ error: "Category is not valid for the transaction direction." }, { status: 400 });
    }
    data.confidence = 1;
  } else if (parsed.data.direction && !categoriesForDirection(direction).some((category) => category === current.aiCategory)) {
    data.aiCategory = defaultCategoryForDirection(direction);
    data.confidence = 1;
  }

  if (parsed.data.jobId) {
    const job = await prisma.job.findFirst({ where: { id: parsed.data.jobId, companyId: current.companyId } });
    if (!job) {
      return NextResponse.json({ error: "Job not found for this company." }, { status: 404 });
    }
    data.confidence = 1;
  }

  if (!parsed.data.status && (data.aiCategory || "jobId" in parsed.data || data.direction)) {
    data.status = TransactionStatus.reviewed;
  }

  const updated = await prisma.transaction.update({
    where: { id: parsed.data.id },
    data,
    include: { job: true, uploadBatch: true },
  });

  return NextResponse.json({
    transaction: {
      id: updated.id,
      date: updated.date.toISOString(),
      merchant: updated.merchant,
      description: updated.description,
      memo: updated.memo,
      amount: Number(updated.amount),
      direction: updated.direction,
      aiCategory: updated.aiCategory,
      confidence: updated.confidence,
      status: updated.status,
      jobId: updated.jobId,
      jobName: updated.job?.name ?? null,
      suggestedJobId: updated.suggestedJobId,
      suggestedJobName: null,
      matchConfidence: updated.matchConfidence,
      matchReason: updated.matchReason,
      uploadBatchId: updated.uploadBatchId,
      uploadBatchFilename: updated.uploadBatch?.filename ?? null,
    },
  });
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const id = new URL(request.url).searchParams.get("id");
  const parsed = transactionPatchSchema.shape.id.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const prisma = getPrisma();
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Demo company is absent." }, { status: 400 });
  }
  const existing = await prisma.transaction.findFirst({
    where: { id: parsed.data, companyId: company.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id: parsed.data } });
  return NextResponse.json({ deleted: true });
}
