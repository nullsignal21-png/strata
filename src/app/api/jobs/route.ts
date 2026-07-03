import { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDemoCompany, getJobsWithFinancials } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await getJobsWithFinancials();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before creating jobs." }, { status: 400 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const customerName = String(body.customerName ?? "").trim();
  const tradeType = String(body.tradeType ?? "").trim();
  const estimatedRevenue = Number(body.estimatedRevenue);
  const actualRevenue = Number(body.actualRevenue);

  if (!name || !customerName || !tradeType || !Number.isFinite(estimatedRevenue) || !Number.isFinite(actualRevenue)) {
    return NextResponse.json({ error: "Name, customer, trade type, and revenue values are required." }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      name,
      customerName,
      tradeType,
      estimatedRevenue,
      actualRevenue,
      status: JobStatus.active,
      startDate: new Date(),
    },
  });

  return NextResponse.json({ job });
}
