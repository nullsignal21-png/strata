import { NextResponse } from "next/server";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";
import { idSchema, jobPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = jobPatchSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job update.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      name: parsed.data.name,
      customerName: parsed.data.customerName,
      tradeType: parsed.data.tradeType,
      city: parsed.data.city || undefined,
      address: parsed.data.address || undefined,
      estimatedRevenue: parsed.data.estimatedRevenue,
      actualRevenue: parsed.data.actualRevenue,
      status: parsed.data.status,
    },
  });

  return NextResponse.json({ job });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }

  const prisma = getPrisma();
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  await prisma.job.delete({ where: { id } });
  logger.info("job_deleted", { companyId: existing.companyId, jobId: id });
  return NextResponse.json({ deleted: true });
}
