import { TransactionDirection } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "@/lib/categorization";
import { escapeCsvCell } from "@/lib/exports";
import { matchJob } from "@/lib/jobMatcher";
import { calculateJobProfitability } from "@/lib/profitability";

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
});

describe("CSV exports", () => {
  it("escapes spreadsheet formulas", () => {
    expect(escapeCsvCell("=cmd|A1")).toBe('"\'=cmd|A1"');
    expect(escapeCsvCell("+SUM(A1:A2)")).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell("-10")).toBe('"\'-10"');
    expect(escapeCsvCell("@risk")).toBe('"\'@risk"');
  });
});
