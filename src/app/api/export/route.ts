import { getReportData } from "@/lib/metrics";

export const runtime = "nodejs";

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const report = await getReportData();
  if (!report) {
    return new Response("No seeded company found.", { status: 400 });
  }

  const rows: Array<Array<string | number | null>> = [
    [
      "job_name",
      "customer",
      "trade_type",
      "status",
      "actual_revenue",
      "total_costs",
      "gross_profit",
      "margin",
      "transaction_date",
      "merchant",
      "description",
      "amount",
      "category",
      "transaction_status",
    ],
  ];

  for (const transaction of report.transactions) {
    const job = report.jobs.find((candidate) => candidate.id === transaction.jobId);
    rows.push([
      job?.name ?? "Unassigned",
      job?.customerName ?? "",
      job?.tradeType ?? "",
      job?.status ?? "",
      job?.actualRevenue ?? 0,
      job?.totalCosts ?? 0,
      job?.grossProfit ?? 0,
      job ? Math.round(job.margin * 100) / 100 : 0,
      transaction.date.slice(0, 10),
      transaction.merchant,
      transaction.description,
      transaction.amount,
      transaction.aiCategory,
      transaction.status,
    ]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="strata-quickbooks-ready-export.csv"',
    },
  });
}
