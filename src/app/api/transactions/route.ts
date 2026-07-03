import { TransactionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { getTransactions } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const transactions = await getTransactions();
  return NextResponse.json({ transactions });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const data: {
    aiCategory?: string;
    jobId?: string | null;
    status?: TransactionStatus;
    confidence?: number;
  } = {};

  if (typeof body.aiCategory === "string") {
    if (!isCategory(body.aiCategory)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    data.aiCategory = body.aiCategory;
    data.confidence = 1;
  }

  if ("jobId" in body) {
    if (body.jobId !== null && typeof body.jobId !== "string") {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
    }
    data.jobId = body.jobId;
    data.confidence = 1;
  }

  if (typeof body.status === "string") {
    if (!Object.values(TransactionStatus).includes(body.status as TransactionStatus)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status as TransactionStatus;
  } else if (data.aiCategory || "jobId" in data) {
    data.status = TransactionStatus.reviewed;
  }

  const updated = await prisma.transaction.update({
    where: { id: body.id },
    data,
    include: { job: true },
  });

  return NextResponse.json({
    transaction: {
      id: updated.id,
      date: updated.date.toISOString(),
      merchant: updated.merchant,
      description: updated.description,
      amount: Number(updated.amount),
      aiCategory: updated.aiCategory,
      confidence: updated.confidence,
      status: updated.status,
      jobId: updated.jobId,
      jobName: updated.job?.name ?? null,
    },
  });
}
