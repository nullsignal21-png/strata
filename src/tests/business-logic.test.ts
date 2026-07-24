import { TransactionDirection, type CategoryRule } from "@prisma/client";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "@/lib/categorization";
import {
  buildJobProfitabilityCsv,
  buildQuickBooksTransactionCsv,
  escapeCsvCell,
} from "@/lib/exports";
import { formatDate } from "@/lib/format";
import { matchJob } from "@/lib/jobMatcher";
import type { JobFinancial, TransactionRow } from "@/lib/metrics";
import { calculateJobProfitability } from "@/lib/profitability";
import { rejectCrossOriginMutation } from "@/lib/requestSecurity";

const jobs = [
  {
    id: "job_1",
    name: "Cary HVAC Replacement - Patel Residence",
    customerName: "Patel Residence",
    tradeType: "HVAC",
    city: "Cary",
    address: "114 Kildaire Farm Rd",
  },
  {
    id: "job_2",
    name: "Apex Commercial Maintenance - Greenway Offices",
    customerName: "Greenway Offices",
    tradeType: "HVAC",
    city: "Apex",
    address: "88 Greenway Park Dr",
  },
];

describe("request security", () => {
  it("accepts the browser origin represented by the Host header", () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3000",
        Origin: "http://127.0.0.1:3000",
      },
    });

    expect(rejectCrossOriginMutation(request)).toBeNull();
  });

  it("accepts a trusted forwarded origin and rejects unrelated origins", () => {
    const forwarded = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "https://preview.example.test",
        "X-Forwarded-Host": "preview.example.test",
        "X-Forwarded-Proto": "https",
      },
    });
    const crossOrigin = new Request("https://app.example.test/api/jobs", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    });

    expect(rejectCrossOriginMutation(forwarded)).toBeNull();
    expect(rejectCrossOriginMutation(crossOrigin)?.status).toBe(403);
  });
});

describe("date formatting", () => {
  it("keeps date-only values stable across local timezones", () => {
    expect(formatDate("2026-06-21T00:00:00.000Z")).toBe("Jun 21, 2026");
  });
});

describe("job matching", () => {
  it("matches by customer, city, and job keywords", () => {
    const result = matchJob("Home Depot Cary Patel condenser pad", jobs);

    expect(result.status).toBe("matched");
    expect(result.jobId).toBe("job_1");
    expect(result.reason).toContain("city matched");
  });

  it("leaves weak matches unassigned", () => {
    const result = matchJob("generic monthly office subscription", jobs);

    expect(result.status).toBe("unmatched");
    expect(result.jobId).toBeNull();
  });
});

describe("categorization", () => {
  it("categorizes expenses without OpenAI", async () => {
    const result = await categorizeTransaction(
      {
        merchant: "Home Depot",
        description: "Home Depot Cary Patel materials",
        memo: null,
        rawCategory: null,
        amount: 120,
        direction: TransactionDirection.expense,
      },
      jobs,
      [],
    );

    expect(result.aiCategory).toBe("Materials");
    expect(result.jobId).toBe("job_1");
    expect(result.status).toBe("categorized");
  });

  it("uses income categories for income transactions", async () => {
    const result = await categorizeTransaction(
      {
        merchant: "Customer Payment",
        description: "Customer payment Patel invoice",
        memo: null,
        rawCategory: null,
        amount: 1000,
        direction: TransactionDirection.income,
      },
      jobs,
      [],
    );

    expect(result.aiCategory).toBe("Customer Payment");
  });

  it.each([
    ["Home Depot", "Materials"],
    ["Lowe's", "Materials"],
    ["Ferguson", "Materials"],
    ["Johnstone Supply", "Materials"],
    ["Grainger", "Tools & Equipment"],
    ["Shell", "Fuel & Vehicle"],
    ["BP", "Fuel & Vehicle"],
    ["Exxon", "Fuel & Vehicle"],
    ["U-Haul", "Fuel & Vehicle"],
    ["QuickBooks", "Software"],
    ["Google Workspace", "Software"],
    ["Verizon", "Utilities"],
    ["Duke Energy", "Utilities"],
    ["Office Depot", "Office/Admin"],
    ["Waste Management", "Job Site / Disposal"],
    ["Insurance", "Insurance"],
    ["permit", "Permits & Fees"],
    ["subcontractor", "Subcontractor"],
    ["meal", "Meals"],
  ])("applies the seeded expense rule for %s", async (merchant, expected) => {
    const result = await categorizeTransaction(
      {
        merchant,
        description: `${merchant} purchase`,
        memo: null,
        rawCategory: null,
        amount: 10,
        direction: TransactionDirection.expense,
      },
      [],
      [],
    );
    expect(result.aiCategory).toBe(expected);
  });

  it("matches rules case-insensitively across whitespace variations", async () => {
    const result = await categorizeTransaction(
      {
        merchant: "  HOME   DEPOT  ",
        description: "generic purchase",
        memo: null,
        rawCategory: null,
        amount: 10,
        direction: TransactionDirection.expense,
      },
      [],
      [],
    );
    expect(result.aiCategory).toBe("Materials");
  });

  it("prioritizes exact and longer company rules deterministically", async () => {
    const now = new Date();
    const rules = [
      {
        id: "rule_home",
        companyId: "company_1",
        keyword: "home",
        category: "Other Expense",
        direction: TransactionDirection.expense,
        tradeType: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rule_home_depot",
        companyId: "company_1",
        keyword: "Home Depot",
        category: "Materials",
        direction: TransactionDirection.expense,
        tradeType: null,
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies CategoryRule[];
    const result = await categorizeTransaction(
      {
        merchant: "Home Depot",
        description: "purchase",
        memo: null,
        rawCategory: null,
        amount: 10,
        direction: TransactionDirection.expense,
      },
      [],
      rules,
    );
    expect(result.aiCategory).toBe("Materials");
    expect(result.confidence).toBe(0.97);
  });

  it("uses a reviewable default when no rule matches and AI is disabled", async () => {
    const result = await categorizeTransaction(
      {
        merchant: "Unknown Merchant",
        description: "unrecognized purchase",
        memo: null,
        rawCategory: null,
        amount: 10,
        direction: TransactionDirection.expense,
      },
      [],
      [],
    );
    expect(result).toMatchObject({
      aiCategory: "Uncategorized",
      confidence: 0.3,
      status: "needs_review",
    });
  });
});

describe("profitability", () => {
  it("does not add imported income to job revenue", () => {
    const result = calculateJobProfitability(5000, [
      { amount: 800, direction: "expense" },
      { amount: 1200, direction: "income" },
    ]);

    expect(result.jobCosts).toBe(800);
    expect(result.cashCollected).toBe(1200);
    expect(result.grossProfit).toBe(4200);
    expect(result.margin).toBe(0.84);
  });

  it("uses exact cent arithmetic and handles zero or negative revenue safely", () => {
    const exact = calculateJobProfitability(0.3, [
      { amount: 0.1, direction: "expense" },
      { amount: 0.2, direction: "expense" },
    ]);
    const zeroRevenue = calculateJobProfitability(0, [{ amount: 10, direction: "expense" }]);

    expect(exact.grossProfit).toBe(0);
    expect(exact.margin).toBe(0);
    expect(zeroRevenue).toMatchObject({ grossProfit: -10, margin: 0 });
    expect(Object.values(zeroRevenue).every(Number.isFinite)).toBe(true);
  });
});

describe("CSV exports", () => {
  it("escapes spreadsheet formulas", () => {
    expect(escapeCsvCell("=cmd|A1")).toBe('"\'=cmd|A1"');
    expect(escapeCsvCell("+SUM(A1:A2)")).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell("-10")).toBe('"\'-10"');
    expect(escapeCsvCell("@risk")).toBe('"\'@risk"');
  });

  it.each([" =cmd", "\t+SUM(A1:A2)", "\r@risk"])(
    "escapes spreadsheet formulas after leading whitespace",
    (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it("exports exact transaction fields with safe quoting and no internal IDs", () => {
    const transaction: TransactionRow = {
      id: "transaction_secret_internal",
      date: "2026-01-02T00:00:00.000Z",
      merchant: "=Café, Services",
      description: "Line one\nLine two",
      memo: "@memo",
      amount: 12.34,
      direction: "expense",
      aiCategory: "Materials",
      confidence: 1,
      status: "reviewed",
      jobId: "job_secret_internal",
      jobName: "QA Job",
      suggestedJobId: null,
      suggestedJobName: null,
      matchConfidence: 0,
      matchReason: null,
      uploadBatchId: "batch_secret_internal",
      uploadBatchFilename: "input.csv",
    };
    const csv = buildQuickBooksTransactionCsv([transaction]);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data[0]).toMatchObject({
      date: "2026-01-02",
      transaction_type: "Expense",
      merchant: "'=Café, Services",
      description: "Line one\nLine two",
      memo: "'@memo",
      direction: "expense",
      amount: "12.34",
      category: "Materials",
      job: "QA Job",
    });
    expect(csv).not.toMatch(/transaction_secret|job_secret|batch_secret|DATABASE_URL|reset-token/i);
  });

  it("exports financially consistent job profitability rows", () => {
    const job: JobFinancial = {
      id: "job_internal",
      name: "QA Job",
      customerName: "Customer",
      tradeType: "HVAC",
      city: null,
      address: null,
      startDate: null,
      endDate: null,
      status: "active",
      estimatedRevenue: 100,
      actualRevenue: 100,
      cashCollected: 75,
      materialCosts: 10,
      otherExpenses: 15,
      totalCosts: 25,
      grossProfit: 75,
      margin: 0.75,
    };
    const parsed = Papa.parse<Record<string, string>>(buildJobProfitabilityCsv([job]), { header: true });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data[0]).toMatchObject({
      actual_revenue: "100.00",
      cash_collected: "75.00",
      job_costs: "25.00",
      gross_profit: "75.00",
      margin: "75",
    });
  });
});
