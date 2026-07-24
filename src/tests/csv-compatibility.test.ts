import { describe, expect, it } from "vitest";
import { parseTransactionCsv, transactionFingerprint } from "@/lib/csv";

const companyId = "company_csv_qa";

function parse(csv: string, options: Record<string, unknown> = {}) {
  return parseTransactionCsv(csv, { companyId, ...options } as Parameters<typeof parseTransactionCsv>[1]);
}

function oneRow(headers: string, values: string, options: Record<string, unknown> = {}) {
  const result = parse(`${headers}\n${values}\n`, options);
  expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
  expect(result.validRowCount).toBe(1);
  return result.transactions[0];
}

describe("CSV compatibility corpus: standard formats", () => {
  it.each([
    ["date,description,amount", "2026-01-02,Supplier purchase,-12.34"],
    ["date,merchant,amount", "2026-01-02,Supplier,-12.34"],
    ["posted date,details,payee,debit,credit", "2026-01-02,Supplier purchase,Supplier,12.34,"],
    ["DATE,DESCRIPTION,AMOUNT", "2026-01-02,Supplier purchase,-12.34"],
    [" amount , extra , description , date ", "-12.34,ignored,Supplier purchase,2026-01-02"],
    ["date,description,merchant,amount,unused", "2026-01-02,Supplier purchase,Supplier,-12.34,ignored"],
  ])("parses %s", (headers, values) => {
    const row = oneRow(headers, values);
    expect(row).toMatchObject({ amount: 12.34, direction: "expense" });
  });

  it("parses explicit transaction types without relying on amount signs", () => {
    const result = parse(
      [
        "date,description,amount,transaction type",
        "2026-01-02,Supplier purchase,12.34,debit",
        "2026-01-03,Customer receipt,50.00,credit",
      ].join("\n"),
    );

    expect(result.transactions.map(({ direction }) => direction)).toEqual(["expense", "income"]);
  });

  it("supports both signed amount conventions", () => {
    const standard = oneRow("date,description,amount", "2026-01-02,Supplier,-12.34");
    const reversed = oneRow(
      "date,description,amount",
      "2026-01-02,Supplier,12.34",
      { signedAmountConvention: "positive_expense" },
    );

    expect(standard.direction).toBe("expense");
    expect(reversed.direction).toBe("expense");
  });

  it.each([
    ["$1,234.56", 1234.56],
    ["USD 125.00", 125],
    ["(88.10)", 88.1],
  ])("parses currency value %s", (amount, expected) => {
    const row = oneRow("date,description,amount", `2026-01-02,Supplier,"${amount}"`);
    expect(row.amount).toBe(expected);
  });

  it("preserves quoted commas, UTF-8, and embedded newlines", () => {
    const result = parse(
      'date,description,merchant,amount\n2026-01-02,"Valve, copper\nassembly",Café Électricité,-12.34\n',
    );

    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({
      description: "Valve, copper\nassembly",
      merchant: "Café Électricité",
    });
  });

  it.each([
    ["UTF-8 BOM", "\uFEFFdate,description,amount\n2026-01-02,Supplier,-12.34\n"],
    ["Windows CRLF", "date,description,amount\r\n2026-01-02,Supplier,-12.34\r\n"],
    ["Unix LF", "date,description,amount\n2026-01-02,Supplier,-12.34\n"],
    ["extra whitespace", " date , description , amount \n 2026-01-02 , Supplier , -12.34 \n"],
  ])("parses %s input", (_name, csv) => {
    expect(parse(csv).validRowCount).toBe(1);
  });
});

describe("CSV compatibility corpus: date formats", () => {
  it.each([
    ["2026-01-31", "2026-01-31"],
    ["01/31/2026", "2026-01-31"],
    ["1/9/2026", "2026-01-09"],
    ["01-31-2026", "2026-01-31"],
    ["2026-01-31T23:15:20Z", "2026-01-31"],
    [" 2026-01-31 ", "2026-01-31"],
    ["2024-02-29", "2024-02-29"],
    ["01/02/2026", "2026-01-02"],
  ])("normalizes %s", (input, expected) => {
    const row = oneRow("date,description,amount", `${input},Supplier,-12.34`);
    expect(row.date).toBe(expected);
  });

  it.each(["2026-02-29", "02/30/2026", "not-a-date", "31/01/2026"])(
    "rejects invalid or unsupported date %s",
    (input) => {
      const result = parse(`date,description,amount\n${input},Supplier,-12.34\n`);
      expect(result.validRowCount).toBe(0);
      expect(result.errors.join(" ")).toMatch(/invalid date/i);
    },
  );
});

describe("CSV compatibility corpus: amounts", () => {
  it.each([
    ["12", 12],
    ["12.34", 12.34],
    ["1.005", 1.01],
    ["0.005", 0.01],
    ["9,999,999,999.99", 9_999_999_999.99],
    ["(12.34)", 12.34],
  ])("normalizes %s to %s", (input, expected) => {
    const row = oneRow("date,description,amount", `2026-01-02,Supplier,"${input}"`);
    expect(row.amount).toBe(expected);
  });

  it.each([
    ["zero", "0"],
    ["rounds to zero", "0.004"],
    ["blank", ""],
    ["non-numeric", "twelve"],
    ["scientific notation", "1e3"],
    ["above database precision", "10,000,000,000.00"],
  ])("rejects %s amount", (_name, input) => {
    const result = parse(`date,description,amount\n2026-01-02,Supplier,"${input}"\n`);
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/invalid.*amount|amount.*invalid/i);
  });

  it("rejects rows with both debit and credit populated", () => {
    const result = parse("date,description,debit,credit\n2026-01-02,Supplier,12.34,50.00\n");
    expect(result.validRowCount).toBe(0);
  });

  it("rejects rows with debit and credit both blank", () => {
    const result = parse("date,description,debit,credit\n2026-01-02,Supplier,,\n");
    expect(result.validRowCount).toBe(0);
  });
});

describe("CSV compatibility corpus: structural corruption", () => {
  it("rejects an empty file with a useful error", () => {
    const result = parse("");
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/empty/i);
  });

  it("rejects a header-only file with a useful error", () => {
    const result = parse("date,description,amount\n");
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/no data|header/i);
  });

  it("rejects missing required columns", () => {
    const result = parse("merchant,category\nSupplier,Materials\n");
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/needs a date column/i);
  });

  it("rejects normalized duplicate header names", () => {
    const result = parse("date,description,amount,Amount\n2026-01-02,Supplier,-12.34,-99.00\n");
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/duplicate header/i);
  });

  it("ignores blank lines", () => {
    const result = parse("\n\ndate,description,amount\n\n2026-01-02,Supplier,-12.34\n\n");
    expect(result.validRowCount).toBe(1);
  });

  it.each([
    ["too few columns", "date,description,amount\n2026-01-02,Supplier\n"],
    ["too many columns", "date,description,amount\n2026-01-02,Supplier,-12.34,unexpected\n"],
    ["broken quotation marks", 'date,description,amount\n2026-01-02,"Supplier,-12.34\n'],
  ])("rejects rows with %s", (_name, csv) => {
    const result = parse(csv);
    expect(result.validRowCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an unrelated CSV", () => {
    const result = parse("first,last,email\nAda,Lovelace,ada@example.test\n");
    expect(result.validRowCount).toBe(0);
  });

  it("accepts a long but bounded Unicode description", () => {
    const description = "配管".repeat(400);
    const row = oneRow("date,description,amount", `2026-01-02,${description},-12.34`);
    expect(row.description).toBe(description);
  });

  it("rejects an excessively long description", () => {
    const description = "x".repeat(1001);
    const result = parse(`date,description,amount\n2026-01-02,${description},-12.34\n`);
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/too long/i);
  });

  it("deduplicates identical rows inside one file", () => {
    const result = parse(
      "date,description,merchant,amount\n2026-01-02,Supplier,Supplier,-12.34\n2026-01-02,Supplier,Supplier,-12.34\n",
    );
    expect(result.validRowCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });
});

describe("CSV compatibility corpus: mapping and fingerprints", () => {
  it("supports manual column remapping", () => {
    const result = parse(
      "when,who,value\n2026-01-02,Supplier,-12.34\n",
      { columnMapping: { date: "when", description: "who", amount: "value" } },
    );
    expect(result.validRowCount).toBe(1);
    expect(result.mappedColumns).toMatchObject({ date: "when", description: "who", amount: "value" });
  });

  it("keeps fingerprints stable across harmless whitespace changes", () => {
    const base = transactionFingerprint({
      companyId,
      date: "2026-01-02",
      merchant: "Supplier",
      description: "Copper valve",
      direction: "expense",
      amount: 12.34,
    });
    const whitespace = transactionFingerprint({
      companyId,
      date: "2026-01-02",
      merchant: "  SUPPLIER ",
      description: "Copper   valve",
      direction: "expense",
      amount: 12.34,
    });
    expect(whitespace).toBe(base);
  });

  it("does not falsely deduplicate genuinely different transactions", () => {
    const first = oneRow("date,description,merchant,amount", "2026-01-02,Supplies,Supplier A,-12.34");
    const second = oneRow("date,description,merchant,amount", "2026-01-02,Supplies,Supplier B,-12.34");
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });
});

describe("CSV compatibility corpus: hostile text", () => {
  it.each(["=2+2", "+SUM(A1:A2)", "-cmd", "@risk", "<b>bold</b>", "<script>alert(1)</script>", "DROP TABLE Transaction;"])(
    "preserves inert text value %s",
    (description) => {
      const row = oneRow("date,description,amount", `2026-01-02,"${description}",-12.34`);
      expect(row.description).toBe(description);
    },
  );

  it.each(["\u0000", "\u0001", "\u0008"])("rejects control character U+%s", (control) => {
    const result = parse(`date,description,amount\n2026-01-02,"Supplier${control}",-12.34\n`);
    expect(result.validRowCount).toBe(0);
    expect(result.errors.join(" ")).toMatch(/control character/i);
  });
});
