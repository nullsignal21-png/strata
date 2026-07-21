import { Prisma, TransactionStatus } from "@prisma/client";
import { categorizeTransaction } from "@/lib/categorization";
import type { ParsedTransaction } from "@/lib/csv";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";

export async function findExistingFingerprints(companyId: string, fingerprints: string[]) {
  if (!fingerprints.length) return new Set<string>();
  const prisma = getPrisma();
  const existing = await prisma.transaction.findMany({
    where: { companyId, fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  });

  return new Set(existing.map((transaction) => transaction.fingerprint));
}

export async function importParsedTransactions(input: {
  companyId: string;
  filename: string;
  transactions: ParsedTransaction[];
  totalRows: number;
  invalidCount: number;
  duplicateCount: number;
  incomeTotal: number;
  expenseTotal: number;
}) {
  const prisma = getPrisma();
  logger.info("upload_started", {
    companyId: input.companyId,
    filename: input.filename,
    rowCount: input.totalRows,
  });

  const existingFingerprints = await findExistingFingerprints(
    input.companyId,
    input.transactions.map((transaction) => transaction.fingerprint),
  );
  const importable = input.transactions.filter((transaction) => !existingFingerprints.has(transaction.fingerprint));

  const [jobs, rules] = await Promise.all([
    prisma.job.findMany({ where: { companyId: input.companyId } }),
    prisma.categoryRule.findMany({ where: { companyId: input.companyId } }),
  ]);

  let importedCount = 0;
  const batch = await prisma.$transaction(async (tx) => {
    const uploadBatch = await tx.uploadBatch.create({
      data: {
        companyId: input.companyId,
        filename: input.filename,
        rowCount: input.totalRows,
        importedCount: 0,
        invalidCount: input.invalidCount,
        duplicateCount: input.duplicateCount + existingFingerprints.size,
        skippedCount: input.invalidCount + input.duplicateCount + existingFingerprints.size,
        incomeTotal: input.incomeTotal,
        expenseTotal: input.expenseTotal,
      },
    });

    for (const transaction of importable) {
      const categorized = await categorizeTransaction(
        {
          merchant: transaction.merchant,
          description: transaction.description,
          memo: transaction.memo,
          rawCategory: transaction.rawCategory,
          amount: transaction.amount,
          direction: transaction.direction,
        },
        jobs,
        rules,
      );

      try {
        await tx.transaction.create({
          data: {
            companyId: input.companyId,
            uploadBatchId: uploadBatch.id,
            jobId: categorized.jobId,
            suggestedJobId: categorized.suggestedJobId,
            matchConfidence: categorized.matchConfidence,
            matchReason: categorized.matchReason,
            date: new Date(`${transaction.date}T00:00:00.000Z`),
            description: transaction.description,
            merchant: transaction.merchant,
            memo: transaction.memo,
            amount: transaction.amount,
            direction: transaction.direction,
            fingerprint: transaction.fingerprint,
            rawCategory: transaction.rawCategory,
            aiCategory: categorized.aiCategory,
            confidence: categorized.confidence,
            status: categorized.status,
            source: "csv",
          },
        });
        importedCount += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }

    return tx.uploadBatch.update({
      where: { id: uploadBatch.id },
      data: {
        importedCount,
        skippedCount: input.totalRows - importedCount,
        duplicateCount: input.totalRows - importedCount - input.invalidCount,
      },
    });
  });

  logger.info("upload_completed", {
    companyId: input.companyId,
    uploadBatchId: batch.id,
    importedCount,
    skippedCount: batch.skippedCount,
  });

  return {
    batchId: batch.id,
    rowCount: input.totalRows,
    importedCount,
    skippedCount: batch.skippedCount,
    duplicateCount: batch.duplicateCount,
    invalidCount: batch.invalidCount,
  };
}

export async function categorizeExistingTransactions(companyId: string, transactionIds?: string[]) {
  const prisma = getPrisma();
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
        memo: transaction.memo,
        rawCategory: transaction.rawCategory,
        amount: Number(transaction.amount),
        direction: transaction.direction,
      },
      jobs,
      rules,
    );

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        jobId: categorized.jobId,
        suggestedJobId: categorized.suggestedJobId,
        matchConfidence: categorized.matchConfidence,
        matchReason: categorized.matchReason,
        aiCategory: categorized.aiCategory,
        confidence: categorized.confidence,
        status: categorized.status,
      },
    });
    updatedCount += 1;
  }

  logger.info("categorization_completed", { companyId, updatedCount });
  return { updatedCount };
}
