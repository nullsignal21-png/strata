import { buildJobProfitabilityCsv, buildQuickBooksTransactionCsv } from "@/lib/exports";
import { logger } from "@/lib/logging";
import { getReportData } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const report = await getReportData();
  if (report.state !== "ready") {
    return new Response(report.message, { status: report.state === "database_unavailable" ? 500 : 400 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "quickbooks";
  const isProfitability = type === "job-profitability";
  const csv = isProfitability
    ? buildJobProfitabilityCsv(report.jobs)
    : buildQuickBooksTransactionCsv(report.transactions);
  const filename = isProfitability ? "strata-job-profitability.csv" : "strata-quickbooks-ready-export.csv";

  logger.info("export_generated", {
    companyId: report.company.id,
    type: isProfitability ? "job_profitability" : "quickbooks_transactions",
    rowCount: isProfitability ? report.jobs.length : report.transactions.length,
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
