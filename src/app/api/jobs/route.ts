import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDemoCompany, getJobsWithFinancials } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { jobCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await getJobsWithFinancials();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Seed the demo company before creating jobs." }, { status: 400 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = jobCreateSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  try {
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
        startDate: parsed.data.startDate
          ? new Date(`${parsed.data.startDate}T00:00:00.000Z`)
          : null,
        endDate: parsed.data.endDate
          ? new Date(`${parsed.data.endDate}T00:00:00.000Z`)
          : null,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A job with this name already exists." }, { status: 409 });
    }
    throw error;
  }
}
