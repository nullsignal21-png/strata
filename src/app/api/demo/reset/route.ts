import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ensureDemoDataWithClient } from "@/lib/demoData";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";
import { readJsonBody, rejectCrossOriginMutation } from "@/lib/requestSecurity";
import { resetDemoSchema } from "@/lib/validation";

export const runtime = "nodejs";

function tokensMatch(supplied: string, expected: string) {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = resetDemoSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "A reset token is required." }, { status: 400 });
  }

  const env = getEnv();
  if (!env.DEMO_RESET_TOKEN || !tokensMatch(parsed.data.token, env.DEMO_RESET_TOKEN)) {
    return NextResponse.json({ error: "Invalid demo reset token." }, { status: 403 });
  }

  const prisma = getPrisma();
  const nextCompany = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtext(${"demo-reset:" + env.DEMO_COMPANY_SLUG})) IS NULL AS "locked"
    `;
    await tx.company.deleteMany({ where: { slug: env.DEMO_COMPANY_SLUG } });
    return ensureDemoDataWithClient(tx, env.DEMO_COMPANY_SLUG);
  });
  logger.info("demo_reset", { companyId: nextCompany.id, slug: nextCompany.slug });
  return NextResponse.json({ reset: true, companyId: nextCompany.id });
}
