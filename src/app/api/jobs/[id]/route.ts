import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logging";
import { getDemoCompany } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { idSchema, jobPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = jobPatchSchema.safeParse({
    ...(typeof body.data === "object" && body.data !== null ? body.data : {}),
    id,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job update.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Demo company is absent." }, { status: 400 });
  }
  const existing = await prisma.job.findFirst({ where: { id, companyId: company.id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  try {
    const job = await prisma.job.update({
      where: { id },
      data: {
        name: parsed.data.name,
        customerName: parsed.data.customerName,
        tradeType: parsed.data.tradeType,
        city: parsed.data.city === undefined ? undefined : parsed.data.city || null,
        address: parsed.data.address === undefined ? undefined : parsed.data.address || null,
        estimatedRevenue: parsed.data.estimatedRevenue,
        actualRevenue: parsed.data.actualRevenue,
        status: parsed.data.status,
        startDate:
          parsed.data.startDate === undefined
            ? undefined
            : parsed.data.startDate
              ? new Date(`${parsed.data.startDate}T00:00:00.000Z`)
              : null,
        endDate:
          parsed.data.endDate === undefined
            ? undefined
            : parsed.data.endDate
              ? new Date(`${parsed.data.endDate}T00:00:00.000Z`)
              : null,
      },
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A job with this name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }

  const prisma = getPrisma();
  const company = await getDemoCompany();
  if (!company) {
    return NextResponse.json({ error: "Demo company is absent." }, { status: 400 });
  }
  const existing = await prisma.job.findFirst({ where: { id, companyId: company.id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: {
        companyId: company.id,
        OR: [{ jobId: id }, { suggestedJobId: id }],
      },
      data: { jobId: null, suggestedJobId: null },
    }),
    prisma.job.delete({ where: { id } }),
  ]);
  logger.info("job_deleted", { companyId: existing.companyId, jobId: id });
  return NextResponse.json({ deleted: true });
}
