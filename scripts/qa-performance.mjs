import { performance } from "node:perf_hooks";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const databaseUrl = process.env.DATABASE_URL ?? "";
const resetToken = process.env.DEMO_RESET_TOKEN;

if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(baseUrl)) {
  throw new Error("Performance QA refuses to target a non-local application URL.");
}
if (!/(?:127\.0\.0\.1|localhost)/.test(databaseUrl)) {
  throw new Error("Performance QA refuses to target a non-local database.");
}
if (!resetToken) {
  throw new Error("DEMO_RESET_TOKEN is required.");
}

function buildCsv(rowCount, { wide = false } = {}) {
  const headers = ["date", "description", "merchant", "memo", "amount"];
  const rows = [headers.join(",")];
  let incomeCents = 0;
  let expenseCents = 0;

  for (let index = 0; index < rowCount; index += 1) {
    const cents = (index % 9_999) + 1;
    const income = index % 4 === 0;
    if (income) incomeCents += cents;
    else expenseCents += cents;
    const day = String((index % 28) + 1).padStart(2, "0");
    const suffix = wide ? "x".repeat(900) : "";
    const merchant = wide ? `QA Merchant ${index} ${"m".repeat(780)}` : `QA Merchant ${index}`;
    const memo = wide ? `QA memo ${"z".repeat(220)}` : "QA synthetic";
    rows.push([
      `2027-03-${day}`,
      `QA performance ${index} ${suffix}`,
      merchant,
      memo,
      `${income ? "" : "-"}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`,
    ].map((value) => `"${value.replaceAll('"', '""')}"`).join(","));
  }

  return {
    csv: rows.join("\r\n"),
    expected: {
      rows: rowCount,
      incomeTotal: incomeCents / 100,
      expenseTotal: expenseCents / 100,
    },
  };
}

async function resetDemo() {
  const response = await fetch(`${baseUrl}/api/demo/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken }),
  });
  if (!response.ok) throw new Error(`Reset failed with ${response.status}.`);
}

async function timedUpload(csv, filename, preview) {
  const form = new FormData();
  form.set("file", new Blob([csv], { type: "text/csv" }), filename);
  form.set("signConvention", "negative_expense");
  if (preview) form.set("preview", "true");

  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/upload`, { method: "POST", body: form });
  const durationMs = performance.now() - started;
  const body = await response.json();
  return { status: response.status, durationMs, body };
}

function assertExactPreview(result, expected) {
  if (result.status !== 200) throw new Error(`Preview failed with ${result.status}.`);
  if (
    result.body.validRowCount !== expected.rows ||
    result.body.invalidRowCount !== 0 ||
    result.body.duplicateCount !== 0 ||
    result.body.incomeTotal !== expected.incomeTotal ||
    result.body.expenseTotal !== expected.expenseTotal
  ) {
    throw new Error(`Preview totals did not match independent totals: ${JSON.stringify(result.body)}`);
  }
}

async function timedGet(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    path,
    status: response.status,
    durationMs: performance.now() - started,
    bytes: Buffer.byteLength(text),
  };
}

const results = [];
for (const rowCount of [10, 100, 1_000]) {
  await resetDemo();
  const fixture = buildCsv(rowCount);
  const preview = await timedUpload(fixture.csv, `qa-${rowCount}.csv`, true);
  assertExactPreview(preview, fixture.expected);
  const imported = await timedUpload(fixture.csv, `qa-${rowCount}.csv`, false);
  if (imported.status !== 200 || imported.body.importedCount !== rowCount) {
    throw new Error(`Import ${rowCount} failed: ${JSON.stringify(imported.body)}`);
  }
  results.push({
    case: `${rowCount} rows`,
    bytes: Buffer.byteLength(fixture.csv),
    previewMs: preview.durationMs,
    importMs: imported.durationMs,
    status: imported.status,
  });
}

await resetDemo();
const rejected = buildCsv(5_000);
const rejectedPreview = await timedUpload(rejected.csv, "qa-5000.csv", true);
if (rejectedPreview.status !== 413) {
  throw new Error(`Expected 5,000 rows to be rejected, received ${rejectedPreview.status}.`);
}
results.push({
  case: "5,000 rows",
  bytes: Buffer.byteLength(rejected.csv),
  previewMs: rejectedPreview.durationMs,
  importMs: null,
  status: rejectedPreview.status,
});

await resetDemo();
const maximum = buildCsv(1_000, { wide: true });
if (Buffer.byteLength(maximum.csv) >= 2 * 1024 * 1024) {
  throw new Error("Maximum fixture unexpectedly exceeds the 2 MB upload boundary.");
}
const maximumPreview = await timedUpload(maximum.csv, "qa-maximum.csv", true);
assertExactPreview(maximumPreview, maximum.expected);
const maximumImport = await timedUpload(maximum.csv, "qa-maximum.csv", false);
if (maximumImport.status !== 200 || maximumImport.body.importedCount !== 1_000) {
  throw new Error(`Maximum safe import failed: ${JSON.stringify(maximumImport.body)}`);
}
results.push({
  case: "maximum safe (1,000 wide rows)",
  bytes: Buffer.byteLength(maximum.csv),
  previewMs: maximumPreview.durationMs,
  importMs: maximumImport.durationMs,
  status: maximumImport.status,
});

const pages = [];
for (const path of ["/transactions", "/reports"]) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    pages.push(await timedGet(path));
  }
}

await resetDemo();
console.log(JSON.stringify({ uploads: results, pages }, null, 2));
