import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseTransactionCsv } from "@/lib/csv";
import { importParsedTransactions } from "@/lib/importTransactions";

const integrationEnabled =
  process.env.STRATA_INTEGRATION_DB === "true" &&
  /(?:127\.0\.0\.1|localhost)/.test(process.env.DATABASE_URL ?? "");
const describeIntegration = integrationEnabled ? describe : describe.skip;
const prisma = new PrismaClient();
const createdCompanyIds: string[] = [];

async function createCompany() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const company = await prisma.company.create({
    data: {
      name: `CSV QA ${suffix}`,
      slug: `csv-qa-${suffix}`,
      tradeType: "QA",
    },
  });
  createdCompanyIds.push(company.id);
  return company;
}

function importInput(companyId: string, filename: string, csv: string) {
  const parsed = parseTransactionCsv(csv, { companyId });
  expect(parsed.errors).toEqual([]);
  return {
    companyId,
    filename,
    transactions: parsed.transactions,
    totalRows: parsed.totalRows,
    invalidCount: parsed.invalidRowCount,
    duplicateCount: parsed.duplicateCount,
    incomeTotal: parsed.incomeTotal,
    expenseTotal: parsed.expenseTotal,
  };
}

describeIntegration("database-backed CSV imports", () => {
  beforeEach(async () => {
    await prisma.uploadBatch.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
    await prisma.transaction.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
  });

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    await prisma.$disconnect();
  });

  it("stores only new-row totals for a partially overlapping import", async () => {
    const company = await createCompany();
    const first = importInput(
      company.id,
      "first.csv",
      "date,description,amount\n2026-01-01,Existing expense,-10.00\n2026-01-02,Existing income,20.00\n",
    );
    const overlap = importInput(
      company.id,
      "overlap.csv",
      "date,description,amount\n2026-01-02,Existing income,20.00\n2026-01-03,New expense,-7.50\n",
    );

    await importParsedTransactions(first);
    const result = await importParsedTransactions(overlap);
    const batch = await prisma.uploadBatch.findUniqueOrThrow({ where: { id: result.batchId } });

    expect(result).toMatchObject({ importedCount: 1, duplicateCount: 1, skippedCount: 1 });
    expect(Number(batch.incomeTotal)).toBe(0);
    expect(Number(batch.expenseTotal)).toBe(7.5);
  });

  it("stores upload-batch totals with exact cent arithmetic", async () => {
    const company = await createCompany();
    const input = importInput(
      company.id,
      "cents.csv",
      [
        "date,description,amount",
        "2026-01-01,Expense one,-0.10",
        "2026-01-02,Expense two,-0.20",
        "2026-01-03,Income one,0.10",
        "2026-01-04,Income two,0.20",
      ].join("\n"),
    );

    const result = await importParsedTransactions(input);
    const batch = await prisma.uploadBatch.findUniqueOrThrow({ where: { id: result.batchId } });

    expect(batch.expenseTotal.toFixed(2)).toBe("0.30");
    expect(batch.incomeTotal.toFixed(2)).toBe("0.30");
  });

  it("does not create an empty batch for a repeated import", async () => {
    const company = await createCompany();
    const input = importInput(
      company.id,
      "repeat.csv",
      "date,description,amount\n2026-01-01,Existing expense,-10.00\n",
    );

    await importParsedTransactions(input);
    await expect(importParsedTransactions(input)).rejects.toThrow(/no new valid transactions/i);

    expect(await prisma.uploadBatch.count({ where: { companyId: company.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { companyId: company.id } })).toBe(1);
  });

  it("serializes concurrent retries without duplicate batches", async () => {
    const company = await createCompany();
    const input = importInput(
      company.id,
      "concurrent.csv",
      "date,description,amount\n2026-01-01,Concurrent expense,-10.00\n",
    );

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => importParsedTransactions(input)),
    );

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await prisma.uploadBatch.count({ where: { companyId: company.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { companyId: company.id } })).toBe(1);
  });

  it("keeps fingerprints company-scoped", async () => {
    const firstCompany = await createCompany();
    const secondCompany = await createCompany();
    const csv = "date,description,amount\n2026-01-01,Shared source row,-10.00\n";

    await importParsedTransactions(importInput(firstCompany.id, "first.csv", csv));
    await importParsedTransactions(importInput(secondCompany.id, "second.csv", csv));

    expect(await prisma.transaction.count({
      where: { companyId: { in: [firstCompany.id, secondCompany.id] } },
    })).toBe(2);
  });
});
