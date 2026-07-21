import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTransactionCsv, transactionFingerprint } from "@/lib/csv";

const companyId = "company_test";

function fixture(name: string) {
  return readFileSync(path.join(process.cwd(), "src/tests/fixtures/csv", name), "utf8");
}

describe("parseTransactionCsv", () => {
  it("maps standard signed amounts and preserves direction", () => {
    const result = parseTransactionCsv(fixture("standard-signed.csv"), { companyId });

    expect(result.mappedColumns.date).toBe("date");
    expect(result.transactions[0]).toMatchObject({ amount: 123.45, direction: "expense" });
    expect(result.transactions[1]).toMatchObject({ amount: 500, direction: "income" });
    expect(result.incomeTotal).toBe(500);
    expect(result.expenseTotal).toBe(123.45);
  });

  it("supports reversed signed amount conventions", () => {
    const result = parseTransactionCsv(fixture("reversed-signed.csv"), {
      companyId,
      signedAmountConvention: "positive_expense",
    });

    expect(result.transactions[0]).toMatchObject({ amount: 123.45, direction: "expense" });
    expect(result.transactions[1]).toMatchObject({ amount: 500, direction: "income" });
  });

  it("uses debit as expense and credit as income", () => {
    const result = parseTransactionCsv(fixture("debit-credit.csv"), { companyId });

    expect(result.mappedColumns.date).toBe("posted date");
    expect(result.transactions.map((row) => row.direction)).toEqual(["expense", "income"]);
  });

  it("parses parentheses, currency symbols, and commas", () => {
    const result = parseTransactionCsv(fixture("parentheses-currency.csv"), { companyId });

    expect(result.transactions[0]).toMatchObject({ amount: 1234.56, direction: "expense" });
    expect(result.transactions[1]).toMatchObject({ amount: 88.1, direction: "income" });
  });

  it("detects duplicate rows inside a file", () => {
    const result = parseTransactionCsv(fixture("duplicates.csv"), { companyId });

    expect(result.validRowCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("reports invalid dates and missing columns", () => {
    const invalidDate = parseTransactionCsv(fixture("invalid-dates.csv"), { companyId });
    const missingColumns = parseTransactionCsv(fixture("missing-columns.csv"), { companyId });

    expect(invalidDate.invalidRowCount).toBe(1);
    expect(missingColumns.errors[0]).toContain("CSV needs a date column");
  });

  it("skips empty rows and parses income and expense combinations", () => {
    const emptyRows = parseTransactionCsv(fixture("empty-rows.csv"), { companyId });
    const debitCredit = parseTransactionCsv(fixture("income-expense.csv"), { companyId });

    expect(emptyRows.validRowCount).toBe(1);
    expect(debitCredit.transactions.map((row) => row.direction)).toEqual(["expense", "income"]);
  });

  it("generates deterministic company-scoped fingerprints", () => {
    const input = {
      companyId,
      date: "2026-06-01",
      merchant: "Home Depot",
      description: "Home Depot Supplies",
      direction: "expense" as const,
      amount: 123.45,
    };

    expect(transactionFingerprint(input)).toBe(transactionFingerprint(input));
    expect(transactionFingerprint(input)).not.toBe(transactionFingerprint({ ...input, companyId: "other_company" }));
  });
});
