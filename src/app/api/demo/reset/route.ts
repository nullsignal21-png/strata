import { NextResponse } from "next/server";
import { ensureDemoData } from "@/lib/demoData";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";
import { resetDemoSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = resetDemoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A reset token is required." }, { status: 400 });
  }

  const env = getEnv();
  if (!env.DEMO_RESET_TOKEN || parsed.data.token !== env.DEMO_RESET_TOKEN) {
    return NextResponse.json({ error: "Invalid demo reset token." }, { status: 403 });
  }

  const prisma = getPrisma();
  const company = await prisma.company.findUnique({ where: { slug: env.DEMO_COMPANY_SLUG } });
  if (company) {
    await prisma.company.delete({ where: { id: company.id } });
  }

  const nextCompany = await ensureDemoData();
  logger.info("demo_reset", { companyId: nextCompany.id, slug: nextCompany.slug });
  return NextResponse.json({ reset: true, companyId: nextCompany.id });
}
