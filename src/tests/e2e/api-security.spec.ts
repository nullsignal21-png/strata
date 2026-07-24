import { expect, test } from "@playwright/test";
import { resetDemo, uploadCsv } from "./helpers";

test.describe("API validation and security boundaries", () => {
  test.beforeEach(async ({ request }) => resetDemo(request));
  test.afterEach(async ({ request }) => resetDemo(request));

  test("health is reachable and unsupported methods are rejected", async ({ request }) => {
    const health = await request.get("/api/health");
    const unsupported = await request.put("/api/jobs", { data: {} });

    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, database: "reachable" });
    expect(unsupported.status()).toBe(405);
  });

  test("malformed, oversized, missing, and stale JSON payloads return safe status codes", async ({ request }) => {
    const malformed = await request.fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      data: "{",
    });
    const oversized = await request.fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ name: "x".repeat(70_000) }),
    });
    const invalidId = await request.patch("/api/transactions", {
      data: { id: "short", status: "reviewed" },
    });
    const staleId = await request.patch("/api/transactions", {
      data: { id: "transaction_that_does_not_exist", status: "reviewed" },
    });

    expect(malformed.status()).toBe(400);
    expect(oversized.status()).toBe(413);
    expect(invalidId.status()).toBe(400);
    expect(staleId.status()).toBe(404);
    expect(await malformed.text()).not.toMatch(/stack|DATABASE_URL|PrismaClient/i);
  });

  test("cross-origin mutation attempts are denied without permissive CORS headers", async ({ request }) => {
    const response = await request.post("/api/jobs", {
      headers: { Origin: "https://attacker.example" },
      data: {
        name: "Cross-origin job",
        customerName: "Attacker",
        tradeType: "QA",
        estimatedRevenue: 1,
        actualRevenue: 1,
      },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(await response.json()).toEqual({ error: "Cross-origin mutations are not allowed." });
  });

  test("upload rejects dangerous MIME types, traversal filenames, and oversized files", async ({ request }) => {
    const executable = await uploadCsv(
      request,
      "date,description,amount\n2027-01-01,Executable,-1\n",
      { filename: "renamed.csv", mimeType: "application/x-msdownload" },
    );
    const traversal = await uploadCsv(
      request,
      "date,description,amount\n2027-01-01,Traversal,-1\n",
      { filename: "..\\..\\escape.csv" },
    );
    const oversized = await uploadCsv(
      request,
      `date,description,amount\n2027-01-01,${"x".repeat(2 * 1024 * 1024)},-1\n`,
      { filename: "oversized.csv" },
    );

    expect(executable.status()).toBe(400);
    expect(traversal.status()).toBe(400);
    expect(oversized.status()).toBe(413);
  });

  test("unrelated, malformed, and over-row-limit CSVs fail without database writes", async ({ request }) => {
    const unrelated = await uploadCsv(request, "first,last,email\nAda,Lovelace,ada@example.test\n", {
      filename: "unrelated.csv",
    });
    const malformed = await uploadCsv(
      request,
      'date,description,amount\n2027-01-01,"broken,-1\n',
      { filename: "malformed.csv" },
    );
    const rows = ["date,description,amount"];
    for (let index = 0; index < 1001; index += 1) {
      rows.push(`2027-01-01,Over limit ${index},-1.00`);
    }
    const overLimit = await uploadCsv(request, rows.join("\n"), {
      filename: "over-limit.csv",
    });
    const overLimitPreview = await uploadCsv(request, rows.join("\n"), {
      filename: "over-limit-preview.csv",
      preview: true,
    });

    expect(unrelated.status()).toBe(409);
    expect(malformed.status()).toBe(409);
    expect(overLimit.status()).toBe(413);
    expect(overLimitPreview.status()).toBe(413);
    expect(await overLimit.text()).toMatch(/1,001 data rows|1000 rows/i);
  });

  test("bulk and categorization endpoints bound request cardinality", async ({ request }) => {
    const ids = Array.from({ length: 201 }, (_, index) => `transaction_${index.toString().padStart(8, "0")}`);
    const bulk = await request.post("/api/transactions/bulk", {
      data: { ids, action: "mark_reviewed" },
    });
    const categorize = await request.post("/api/categorize", {
      data: { transactionIds: ids },
    });

    expect(bulk.status()).toBe(400);
    expect(categorize.status()).toBe(400);
  });
});
