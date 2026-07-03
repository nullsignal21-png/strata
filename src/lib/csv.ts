import Papa from "papaparse";

export type ParsedTransaction = {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  rawCategory: string | null;
  memo: string | null;
  fingerprint: string;
};

export type ParseResult = {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedRows: number;
};

type CsvRow = Record<string, string | undefined>;

const aliases = {
  date: ["date", "transactiondate", "posteddate", "postingdate", "postdate"],
  description: ["description", "details", "memo", "note", "notes", "transactiondescription"],
  merchant: ["merchant", "vendor", "payee", "name"],
  amount: ["amount", "transactionamount", "netamount"],
  debit: ["debit", "withdrawal", "charge", "expense"],
  credit: ["credit", "deposit", "payment"],
  category: ["category", "type", "classification"],
  memo: ["memo", "note", "notes"],
};

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(headers: string[]) {
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

function parseCurrency(raw: string) {
  const cleaned = raw.replace(/[$,\s()]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return raw.includes("(") && raw.includes(")") ? -Math.abs(value) : value;
}

function parseAmount(row: CsvRow, map: ReturnType<typeof buildHeaderMap>) {
  const amount = parseCurrency(cell(row, map.amount));
  if (amount !== null) return amount;

  const debit = parseCurrency(cell(row, map.debit));
  if (debit !== null && debit !== 0) return Math.abs(debit);

  const credit = parseCurrency(cell(row, map.credit));
  if (credit !== null && credit !== 0) return -Math.abs(credit);

  return null;
}

function parseDate(raw: string) {
  const value = Date.parse(raw);
  if (Number.isNaN(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function fingerprintFor(transaction: Omit<ParsedTransaction, "fingerprint">) {
  return [
    transaction.date,
    transaction.description.toLowerCase(),
    transaction.merchant.toLowerCase(),
    transaction.amount.toFixed(2),
  ].join("|");
}

export function parseTransactionCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors = parsed.errors.map((error) => `Row ${error.row ?? "unknown"}: ${error.message}`);
  const headers = parsed.meta.fields ?? [];
  const map = buildHeaderMap(headers);

  if (!map.date || (!map.amount && !map.debit && !map.credit) || (!map.description && !map.merchant)) {
    return {
      transactions: [],
      skippedRows: parsed.data.length,
      errors: [
        ...errors,
        "CSV needs a date column, an amount/debit/credit column, and a description or merchant column.",
      ],
    };
  }

  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];
  let skippedRows = 0;

  parsed.data.forEach((row, index) => {
    const date = parseDate(cell(row, map.date));
    const amount = parseAmount(row, map);
    const merchant = cell(row, map.merchant);
    const description = cell(row, map.description) || merchant;

    if (!date || amount === null || amount === 0 || !description) {
      skippedRows += 1;
      errors.push(`Row ${index + 2}: missing or invalid date, amount, or description.`);
      return;
    }

    const normalized: Omit<ParsedTransaction, "fingerprint"> = {
      date,
      description,
      merchant: merchant || description,
      amount: Math.abs(amount),
      rawCategory: cell(row, map.category) || null,
      memo: cell(row, map.memo) || null,
    };
    const fingerprint = fingerprintFor(normalized);

    if (seen.has(fingerprint)) {
      skippedRows += 1;
      return;
    }

    seen.add(fingerprint);
    transactions.push({ ...normalized, fingerprint });
  });

  return { transactions, errors, skippedRows };
}
