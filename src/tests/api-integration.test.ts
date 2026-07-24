import { PrismaClient, TransactionDirection } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as resetDemo } from "@/app/api/demo/reset/route";
import { DELETE as deleteJob, PATCH as patchJob } from "@/app/api/jobs/[id]/route";
import { POST as createJob } from "@/app/api/jobs/route";
import {
  DELETE as deleteTransaction,
  PATCH as patchTransaction,
} from "@/app/api/transactions/route";
import { transactionFingerprint } from "@/lib/csv";
import { getJobDetail } from "@/lib/metrics";

const integrationEnabled =
  process.env.STRATA_INTEGRATION_DB === "true" &&
  /(?:127\.0\.0\.1|localhost)/.test(process.env.DATABASE_URL ?? "");
const describeIntegration = integrationEnabled ? describe : describe.skip;
const prisma = new PrismaClient();
let demoCompanyId = "";
const cleanupCompanyIds: string[] = [];
const cleanupJobIds: string[] = [];
const cleanupTransactionIds: string[] = [];

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function foreignCompany() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const company = await prisma.company.create({
    data: { name: `Foreign ${suffix}`, slug: `foreign-${suffix}`, tradeType: "QA" },
  });
  cleanupCompanyIds.push(company.id);
  return company;
}

async function jobFor(companyId: string, name = `QA Job ${crypto.randomUUID()}`) {
  const job = await prisma.job.create({
    data: {
      companyId,
      name,
      customerName: "QA Customer",
      tradeType: "QA",
      status: "active",
      estimatedRevenue: 100,
      actualRevenue: 100,
    },
  });
  cleanupJobIds.push(job.id);
  return job;
}

async function transactionFor(companyId: string, jobId: string | null = null) {
  const description = `QA transaction ${crypto.randomUUID()}`;
  const fingerprint = transactionFingerprint({
    companyId,
    date: "2026-01-02",
    merchant: "QA Merchant",
    description,
    direction: "expense",
    amount: 12.34,
  });
  const transaction = await prisma.transaction.create({
    data: {
      companyId,
      jobId,
      suggestedJobId: jobId,
      date: new Date("2026-01-02T00:00:00.000Z"),
      description,
      merchant: "QA Merchant",
      amount: 12.34,
      direction: TransactionDirection.expense,
      fingerprint,
    },
  });
  cleanupTransactionIds.push(transaction.id);
  return transaction;
}

describeIntegration("API company isolation and invariants", () => {
  beforeAll(async () => {
    const demo = await prisma.company.findUnique({ where: { slug: "triangle-hvac-plumbing" } });
    if (!demo) throw new Error("Seed the isolated QA database before running integration tests.");
    demoCompanyId = demo.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: { in: cleanupTransactionIds } } });
    await prisma.job.deleteMany({ where: { id: { in: cleanupJobIds } } });
    await prisma.company.deleteMany({ where: { id: { in: cleanupCompanyIds } } });
    await prisma.$disconnect();
  });

  it("rejects cross-company transaction updates and deletes", async () => {
    const foreign = await foreignCompany();
    const updateTarget = await transactionFor(foreign.id);
    const deleteTarget = await transactionFor(foreign.id);

    const updateResponse = await patchTransaction(
      jsonRequest("http://localhost/api/transactions", "PATCH", {
        id: updateTarget.id,
        aiCategory: "Materials",
      }),
    );
    const deleteResponse = await deleteTransaction(
      new Request(`http://localhost/api/transactions?id=${deleteTarget.id}`, { method: "DELETE" }),
    );

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(await prisma.transaction.count({
      where: { id: { in: [updateTarget.id, deleteTarget.id] } },
    })).toBe(2);
  });

  it("rejects cross-company job reads, updates, and deletes", async () => {
    const foreign = await foreignCompany();
    const updateTarget = await jobFor(foreign.id);
    const deleteTarget = await jobFor(foreign.id);

    const detail = await getJobDetail(updateTarget.id);
    const updateResponse = await patchJob(
      jsonRequest(`http://localhost/api/jobs/${updateTarget.id}`, "PATCH", { name: "Unauthorized rename" }),
      { params: Promise.resolve({ id: updateTarget.id }) },
    );
    const deleteResponse = await deleteJob(
      new Request(`http://localhost/api/jobs/${deleteTarget.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: deleteTarget.id }) },
    );

    expect(detail).toBeNull();
    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("clears assignments and suggestions when deleting a job", async () => {
    const job = await jobFor(demoCompanyId);
    const transaction = await transactionFor(demoCompanyId, job.id);

    const response = await deleteJob(
      new Request(`http://localhost/api/jobs/${job.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: job.id }) },
    );
    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } });

    expect(response.status).toBe(200);
    expect(updated.jobId).toBeNull();
    expect(updated.suggestedJobId).toBeNull();
  });

  it("returns a conflict instead of a server error for duplicate job names", async () => {
    const name = `Duplicate QA Job ${crypto.randomUUID()}`;
    const body = {
      name,
      customerName: "QA Customer",
      tradeType: "QA",
      estimatedRevenue: 100,
      actualRevenue: 100,
      status: "active",
    };

    const first = await createJob(jsonRequest("http://localhost/api/jobs", "POST", body));
    const second = await createJob(jsonRequest("http://localhost/api/jobs", "POST", body));
    const firstPayload = await first.json() as { job: { id: string } };
    cleanupJobIds.push(firstPayload.job.id);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("edits and clears job fields with strict financial and date validation", async () => {
    const job = await jobFor(demoCompanyId);
    const valid = await patchJob(
      jsonRequest(`http://localhost/api/jobs/${job.id}`, "PATCH", {
        city: "",
        address: "",
        startDate: "2024-02-29",
        endDate: "2024-03-01",
        estimatedRevenue: "9999999999.99",
        actualRevenue: "123.45",
      }),
      { params: Promise.resolve({ id: job.id }) },
    );
    const invalidDate = await patchJob(
      jsonRequest(`http://localhost/api/jobs/${job.id}`, "PATCH", { startDate: "2026-02-29" }),
      { params: Promise.resolve({ id: job.id }) },
    );
    const invalidMoney = await patchJob(
      jsonRequest(`http://localhost/api/jobs/${job.id}`, "PATCH", { actualRevenue: "1.005" }),
      { params: Promise.resolve({ id: job.id }) },
    );
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });

    expect(valid.status).toBe(200);
    expect(updated.city).toBeNull();
    expect(updated.address).toBeNull();
    expect(updated.startDate?.toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(updated.endDate?.toISOString().slice(0, 10)).toBe("2024-03-01");
    expect(Number(updated.estimatedRevenue)).toBe(9_999_999_999.99);
    expect(Number(updated.actualRevenue)).toBe(123.45);
    expect(invalidDate.status).toBe(400);
    expect(invalidMoney.status).toBe(400);
  });

  it("rejects missing and incorrect reset tokens", async () => {
    const missing = await resetDemo(jsonRequest("http://localhost/api/demo/reset", "POST", {}));
    const incorrect = await resetDemo(
      jsonRequest("http://localhost/api/demo/reset", "POST", { token: "incorrect-reset-token" }),
    );

    expect(missing.status).toBe(400);
    expect(incorrect.status).toBe(403);
  });

  it("resets atomically, preserves unrelated companies, and tolerates concurrent requests", async () => {
    const unrelated = await foreignCompany();
    await jobFor(demoCompanyId, `Reset mutation ${crypto.randomUUID()}`);
    await prisma.uploadBatch.create({
      data: {
        companyId: demoCompanyId,
        filename: "reset-mutation.csv",
        rowCount: 0,
        importedCount: 0,
      },
    });
    const request = () =>
      resetDemo(
        jsonRequest("http://localhost/api/demo/reset", "POST", {
          token: process.env.DEMO_RESET_TOKEN,
        }),
      );

    const responses = await Promise.all([request(), request()]);
    const demo = await prisma.company.findUniqueOrThrow({
      where: { slug: "triangle-hvac-plumbing" },
    });
    const [jobs, transactions, rules, batches, unrelatedCount] = await Promise.all([
      prisma.job.count({ where: { companyId: demo.id } }),
      prisma.transaction.count({ where: { companyId: demo.id } }),
      prisma.categoryRule.count({ where: { companyId: demo.id } }),
      prisma.uploadBatch.count({ where: { companyId: demo.id } }),
      prisma.company.count({ where: { id: unrelated.id } }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect({ jobs, transactions, rules, batches }).toEqual({
      jobs: 5,
      transactions: 32,
      rules: 19,
      batches: 1,
    });
    expect(unrelatedCount).toBe(1);
    demoCompanyId = demo.id;
  });
});
