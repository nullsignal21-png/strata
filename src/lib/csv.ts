import crypto from "node:crypto";
import Papa from "papaparse";
import type { TransactionDirectionValue } from "@/lib/categories";

export const CSV_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 1000,
};

export type SignedAmountConvention = "negative_expense" | "positive_expense";

export type ParsedTransaction = {
  date: string;
  description: string;
  merchant: string;
  memo: string | null;
  amount: number;
  direction: TransactionDirectionValue;
  rawCategory: string | null;
  fingerprint: string;
};

export type ParseResult = {
  transactions: ParsedTransaction[];
  errors: string[];
  mappedColumns: Record<string, string | null>;
  signConvention: SignedAmountConvention;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateCount: number;
  skippedRows: number;
  incomeTotal: number;
  expenseTotal: number;
};

type CsvRow = Record<string, string | undefined>;

const aliases = {
  date: ["date", "transactiondate", "posteddate", "postingdate", "postdate"],
  description: ["description", "details", "detail", "transactiondescription", "narrative"],
  merchant: ["merchant", "vendor", "payee", "name"],
  amount: ["amount", "transactionamount", "netamount", "value"],
  debit: ["debit", "withdrawal", "withdrawals", "charge", "charges", "expense"],
  credit: ["credit", "deposit", "deposits", "payment", "payments"],
  category: ["category", "type", "classification"],
  memo: ["memo", "note", "notes", "reference"],
};

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildHeaderMap(headers: string[]) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));

  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      names.map((name) => normalized.get(name)).find(Boolean) ?? null,
    ]),
  ) as Record<keyof typeof aliases, string | null>;
}

function cell(row: CsvRow, header: string | null) {
  return header ? row[header]?.trim() ?? "" : "";
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseCurrency(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parenthesized = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[,$\s()]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return parenthesized ? -Math.abs(value) : value;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function directionFromSignedAmount(amount: number, convention: SignedAmountConvention): TransactionDirectionValue {
  if (convention === "positive_expense") {
    return amount > 0 ? "expense" : "income";
  }

  return amount < 0 ? "expense" : "income";
}

function parseAmount(
  row: CsvRow,
  map: ReturnType<typeof buildHeaderMap>,
  convention: SignedAmountConvention,
): { amount: number; direction: TransactionDirectionValue } | null {
  const debit = parseCurrency(cell(row, map.debit));
  const credit = parseCurrency(cell(row, map.credit));

  if ((map.debit || map.credit) && (debit !== null || credit !== null)) {
    const hasDebit = debit !== null && debit !== 0;
    const hasCredit = credit !== null && credit !== 0;
    if (hasDebit && hasCredit) return null;
    if (hasDebit) return { amount: roundMoney(Math.abs(debit)), direction: "expense" };
    if (hasCredit) return { amount: roundMoney(Math.abs(credit)), direction: "income" };
  }

  const amount = parseCurrency(cell(row, map.amount));
  if (amount === null || amount === 0) return null;

  return {
    amount: roundMoney(Math.abs(amount)),
    direction: directionFromSignedAmount(amount, convention),
  };
}

function parseDate(raw: string) {
  const value = Date.parse(raw);
  if (Number.isNaN(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function transactionFingerprint(input: {
  companyId: string;
  date: string;
  merchant: string;
  description: string;
  direction: TransactionDirectionValue;
  amount: number;
}) {
  const payload = [
    input.companyId,
    input.date,
    normalizeText(input.merchant),
    normalizeText(input.description),
    input.direction,
    input.amount.toFixed(2),
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function parseTransactionCsv(
  csvText: string,
  options: {
    companyId: string;
    signedAmountConvention?: SignedAmountConvention;
    maxRows?: number;
  },
): ParseResult {
  const signConvention = options.signedAmountConvention ?? "negative_expense";
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors = parsed.errors.map((error) => `Row ${error.row ?? "unknown"}: ${error.message}`);
  const headers = parsed.meta.fields ?? [];
  const map = buildHeaderMap(headers);
  const totalRows = parsed.data.length;
  const maxRows = options.maxRows ?? CSV_LIMITS.maxRows;

  if (totalRows > maxRows) {
    return {
      transactions: [],
      errors: [...errors, `CSV has ${totalRows} data rows. The demo limit is ${maxRows} rows.`],
      mappedColumns: map,
      signConvention,
      totalRows,
      validRowCount: 0,
      invalidRowCount: totalRows,
      duplicateCount: 0,
      skippedRows: totalRows,
      incomeTotal: 0,
      expenseTotal: 0,
    };
  }

  if (!map.date || (!map.amount && !map.debit && !map.credit) || (!map.description && !map.merchant)) {
    return {
      transactions: [],
      errors: [
        ...errors,
        "CSV needs a date column, an amount/debit/credit column, and a description or merchant column.",
      ],
      mappedColumns: map,
      signConvention,
      totalRows,
      validRowCount: 0,
      invalidRowCount: totalRows,
      duplicateCount: 0,
      skippedRows: totalRows,
      incomeTotal: 0,
      expenseTotal: 0,
    };
  }

  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];
  let invalidRowCount = 0;
  let duplicateCount = 0;
  let incomeTotal = 0;
  let expenseTotal = 0;

  parsed.data.forEach((row, index) => {
    const date = parseDate(cell(row, map.date));
    const parsedAmount = parseAmount(row, map, signConvention);
    const merchant = cell(row, map.merchant);
    const description = cell(row, map.description) || merchant;

    if (!date || !parsedAmount || !description) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: missing or invalid date, amount, or description.`);
      return;
    }

    const transaction = {
      date,
      description,
      merchant: merchant || description,
      memo: cell(row, map.memo) || null,
      amount: parsedAmount.amount,
      direction: parsedAmount.direction,
      rawCategory: cell(row, map.category) || null,
    };
    const fingerprint = transactionFingerprint({ companyId: options.companyId, ...transaction });

    if (seen.has(fingerprint)) {
      duplicateCount += 1;
      return;
    }

    seen.add(fingerprint);
    transactions.push({ ...transaction, fingerprint });
    if (transaction.direction === "income") {
      incomeTotal += transaction.amount;
    } else {
      expenseTotal += transaction.amount;
    }
  });

  return {
    transactions,
    errors,
    mappedColumns: map,
    signConvention,
    totalRows,
    validRowCount: transactions.length,
    invalidRowCount,
    duplicateCount,
    skippedRows: invalidRowCount + duplicateCount,
    incomeTotal: roundMoney(incomeTotal),
    expenseTotal: roundMoney(expenseTotal),
  };
}
