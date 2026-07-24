import crypto from "node:crypto";
import Papa from "papaparse";
import type { TransactionDirectionValue } from "@/lib/categories";

export const CSV_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 1000,
  maxTextLength: 1000,
};

export type SignedAmountConvention = "negative_expense" | "positive_expense";
export type CsvColumn =
  | "date"
  | "description"
  | "merchant"
  | "amount"
  | "debit"
  | "credit"
  | "transactionType"
  | "category"
  | "memo";
export type CsvColumnMapping = Partial<Record<CsvColumn, string | null>>;

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
  headers: string[];
  mappedColumns: Record<CsvColumn, string | null>;
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
  transactionType: ["transactiontype", "type", "debitcredit", "drcr"],
  category: ["category", "type", "classification"],
  memo: ["memo", "note", "notes", "reference"],
} satisfies Record<CsvColumn, string[]>;

const maxAmountCents = 999_999_999_999;
const unsafeControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildHeaderMap(headers: string[], overrides: CsvColumnMapping = {}) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));

  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      field in overrides
        ? headers.find((header) => header === overrides[field as CsvColumn]) ?? null
        : names.map((name) => normalized.get(name)).find(Boolean) ?? null,
    ]),
  ) as Record<CsvColumn, string | null>;
}

function cell(row: CsvRow, header: string | null) {
  return header ? row[header]?.trim() ?? "" : "";
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseCurrency(raw: string) {
  let text = raw.trim();
  if (!text) return null;

  const parenthesized = /^\(.*\)$/.test(text);
  if (parenthesized) text = text.slice(1, -1).trim();

  let negative = parenthesized;
  if (text.startsWith("-") || text.startsWith("+")) {
    if (parenthesized) return null;
    negative = text.startsWith("-");
    text = text.slice(1).trim();
  }

  text = text.replace(/^USD\s*/i, "").replace(/\s*USD$/i, "").trim();
  if (text.startsWith("$")) text = text.slice(1).trim();

  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text)) return null;

  const [wholePart, fractionPart = ""] = text.replace(/,/g, "").split(".");
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, "");
  if (normalizedWhole.length > 10) return null;

  let cents = Number(normalizedWhole) * 100;
  cents += Number((fractionPart.slice(0, 2) + "00").slice(0, 2));
  if ((fractionPart[2] ?? "0") >= "5") cents += 1;
  if (cents > maxAmountCents) return null;

  const value = Number(cents) / 100;
  return negative ? -value : value;
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
  const debitText = cell(row, map.debit);
  const creditText = cell(row, map.credit);

  if ((map.debit || map.credit) && (debitText || creditText)) {
    const debit = parseCurrency(debitText);
    const credit = parseCurrency(creditText);
    const hasDebit = debit !== null && debit !== 0;
    const hasCredit = credit !== null && credit !== 0;
    if ((debitText && debit === null) || (creditText && credit === null) || (hasDebit && hasCredit)) return null;
    if (hasDebit) return { amount: Math.abs(debit), direction: "expense" };
    if (hasCredit) return { amount: Math.abs(credit), direction: "income" };
    return null;
  }

  const amount = parseCurrency(cell(row, map.amount));
  if (amount === null || amount === 0) return null;
  const explicitDirection = directionFromType(cell(row, map.transactionType));

  return {
    amount: Math.abs(amount),
    direction: explicitDirection ?? directionFromSignedAmount(amount, convention),
  };
}

function parseDate(raw: string) {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const usDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);

  if (isoDate) {
    [, year, month, day] = isoDate.map(Number);
  } else if (usDate) {
    month = Number(usDate[1]);
    day = Number(usDate[2]);
    year = Number(usDate[3]);
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return null;
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 10);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function directionFromType(raw: string): TransactionDirectionValue | null {
  const value = normalizeHeader(raw);
  if (["debit", "withdrawal", "expense", "purchase", "charge"].includes(value)) return "expense";
  if (["credit", "deposit", "income", "receipt"].includes(value)) return "income";
  return null;
}

function emptyResult(input: {
  errors: string[];
  headers?: string[];
  mappedColumns?: Record<CsvColumn, string | null>;
  signConvention: SignedAmountConvention;
  totalRows?: number;
}): ParseResult {
  const headers = input.headers ?? [];
  return {
    transactions: [],
    errors: input.errors,
    headers,
    mappedColumns: input.mappedColumns ?? buildHeaderMap(headers),
    signConvention: input.signConvention,
    totalRows: input.totalRows ?? 0,
    validRowCount: 0,
    invalidRowCount: input.totalRows ?? 0,
    duplicateCount: 0,
    skippedRows: input.totalRows ?? 0,
    incomeTotal: 0,
    expenseTotal: 0,
  };
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
    columnMapping?: CsvColumnMapping;
  },
): ParseResult {
  const signConvention = options.signedAmountConvention ?? "negative_expense";
  if (!csvText.trim()) {
    return emptyResult({ errors: ["CSV is empty."], signConvention });
  }

  const headerPreview = Papa.parse<string[]>(csvText, {
    preview: 1,
    skipEmptyLines: "greedy",
  });
  const headers = (headerPreview.data[0] ?? []).map((header) => String(header).trim());
  const normalizedHeaders = headers.map(normalizeHeader).filter(Boolean);
  const duplicateHeaders = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);

  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors = parsed.errors.map((error) => {
    const row = typeof error.row === "number" ? error.row + 2 : "unknown";
    return `Row ${row}: ${error.message}`;
  });
  const parsedHeaders = parsed.meta.fields ?? headers;
  const map = buildHeaderMap(parsedHeaders, options.columnMapping);
  const totalRows = parsed.data.length;
  const maxRows = options.maxRows ?? CSV_LIMITS.maxRows;
  const structuralErrorRows = new Set(
    parsed.errors
      .filter((error) => error.type === "FieldMismatch" || error.code === "MissingQuotes")
      .map((error) => error.row)
      .filter((row): row is number => typeof row === "number"),
  );

  if (duplicateHeaders.length) {
    return emptyResult({
      errors: [...errors, `CSV contains duplicate header names: ${Array.from(new Set(duplicateHeaders)).join(", ")}.`],
      headers: parsedHeaders,
      mappedColumns: map,
      signConvention,
      totalRows,
    });
  }

  const missingOverrides = Object.entries(options.columnMapping ?? {})
    .filter(([, header]) => header && !parsedHeaders.includes(header))
    .map(([field]) => field);
  if (missingOverrides.length) {
    return emptyResult({
      errors: [...errors, `Mapped columns were not found for: ${missingOverrides.join(", ")}.`],
      headers: parsedHeaders,
      mappedColumns: map,
      signConvention,
      totalRows,
    });
  }

  if (totalRows > maxRows) {
    return emptyResult({
      errors: [...errors, `CSV has ${totalRows} data rows. The demo limit is ${maxRows} rows.`],
      headers: parsedHeaders,
      mappedColumns: map,
      signConvention,
      totalRows,
    });
  }

  if (!map.date || (!map.amount && !map.debit && !map.credit) || (!map.description && !map.merchant)) {
    return emptyResult({
      errors: [
        ...errors,
        "CSV needs a date column, an amount/debit/credit column, and a description or merchant column.",
      ],
      headers: parsedHeaders,
      mappedColumns: map,
      signConvention,
      totalRows,
    });
  }

  if (totalRows === 0) {
    return emptyResult({
      errors: [...errors, "CSV contains headers but no data rows."],
      headers: parsedHeaders,
      mappedColumns: map,
      signConvention,
    });
  }

  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];
  let invalidRowCount = 0;
  let duplicateCount = 0;
  let incomeTotal = 0;
  let expenseTotal = 0;

  parsed.data.forEach((row, index) => {
    if (structuralErrorRows.has(index)) {
      invalidRowCount += 1;
      return;
    }

    const date = parseDate(cell(row, map.date));
    const parsedAmount = parseAmount(row, map, signConvention);
    const merchant = cell(row, map.merchant);
    const description = cell(row, map.description) || merchant;
    const memo = cell(row, map.memo);
    const textValues = [merchant, description, memo, cell(row, map.category)];

    if (!date) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: missing or invalid date.`);
      return;
    }
    if (!parsedAmount) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: missing or invalid amount.`);
      return;
    }
    if (!description) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: missing description or merchant.`);
      return;
    }
    if (textValues.some((value) => unsafeControlCharacters.test(value))) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: text contains an unsupported control character.`);
      return;
    }
    if (textValues.some((value) => value.length > CSV_LIMITS.maxTextLength)) {
      invalidRowCount += 1;
      errors.push(`Row ${index + 2}: text value is too long (maximum ${CSV_LIMITS.maxTextLength} characters).`);
      return;
    }

    const transaction = {
      date,
      description,
      merchant: merchant || description,
      memo: memo || null,
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
    headers: parsedHeaders,
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
