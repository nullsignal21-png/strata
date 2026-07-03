import { TransactionStatus } from "@prisma/client";
import { categorizeTransaction } from "@/lib/categorization";
import type { ParsedTransaction } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function importParsedTransactions(input: {
  companyId: string;
  filename: string;
  transactions: ParsedTransaction[];
}) {
  const batch = await prisma.uploadBatch.create({
    data: {
      companyId: input.companyId,
      filename: input.filename,
      rowCount: input.transactions.length,
      importedCount: 0,
    },
  });

  const [jobs, rules] = await Promise.all([
    prisma.job.findMany({ where: { companyId: input.companyId } }),
    prisma.categoryRule.findMany({ where: { companyId: input.companyId } }),
  ]);

  let importedCount = 0;
  let skippedCount = 0;

  for (const transaction of input.transactions) {
    const existing = await prisma.transaction.findFirst({
      where: {
        companyId: input.companyId,
        date: new Date(`${transaction.date}T00:00:00.000Z`),
        description: transaction.description,
        merchant: transaction.merchant,
        amount: transaction.amount,
      },
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const categorized = await categorizeTransaction(
      {
        merchant: transaction.merchant,
        description: `${transaction.description} ${transaction.memo ?? ""}`,
        rawCategory: transaction.rawCategory,
        amount: transaction.amount,
      },
      jobs,
      rules,
    );

    await prisma.transaction.create({
      data: {
        companyId: input.companyId,
        uploadBatchId: batch.id,
        jobId: categorized.jobId,
        date: new Date(`${transaction.date}T00:00:00.000Z`),
        description: transaction.description,
        merchant: transaction.merchant,
        amount: transaction.amount,
        rawCategory: transaction.rawCategory,
        aiCategory: categorized.aiCategory,
        confidence: categorized.confidence,
        status: categorized.status,
        source: "csv",
      },
    });

    importedCount += 1;
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { importedCount },
  });

  return { batchId: batch.id, rowCount: input.transactions.length, importedCount, skippedCount };
}

export async function categorizeExistingTransactions(companyId: string, transactionIds?: string[]) {
  const [jobs, rules, transactions] = await Promise.all([
    prisma.job.findMany({ where: { companyId } }),
    prisma.categoryRule.findMany({ where: { companyId } }),
    prisma.transaction.findMany({
      where: {
        companyId,
        id: transactionIds?.length ? { in: transactionIds } : undefined,
        status: transactionIds?.length ? undefined : { in: [TransactionStatus.imported, TransactionStatus.needs_review] },
      },
    }),
  ]);

  let updatedCount = 0;

  for (const transaction of transactions) {
    const categorized = await categorizeTransaction(
      {
        merchant: transaction.merchant,
        description: transaction.description,
        rawCategory: transaction.rawCategory,
        amount: Number(transaction.amount),
      },
      jobs,
      rules,
    );

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        jobId: categorized.jobId,
        aiCategory: categorized.aiCategory,
        confidence: categorized.confidence,
        status: categorized.status,
      },
    });
    updatedCount += 1;
  }

  return { updatedCount };
}
