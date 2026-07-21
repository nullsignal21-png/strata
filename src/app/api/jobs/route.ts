import { NextResponse } from "next/server";
import { getDemoCompany, getJobsWithFinancials } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { jobCreateSchema } from "@/lib/validation";

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

  const parsed = jobCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      name: parsed.data.name,
      customerName: parsed.data.customerName,
      tradeType: parsed.data.tradeType,
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      estimatedRevenue: parsed.data.estimatedRevenue,
      actualRevenue: parsed.data.actualRevenue,
      status: parsed.data.status,
      startDate: new Date(),
    },
  });

  return NextResponse.json({ job }, { status: 201 });
}
