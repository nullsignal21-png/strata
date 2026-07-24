import crypto from "node:crypto";
import { IntegrationProvider } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/metrics";
import { getPrisma } from "@/lib/prisma";
import { hasQuickBooksEnv } from "@/lib/quickbooks";

export const runtime = "nodejs";

function stateMatches(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("strata_qb_oauth_state")?.value;
  const company = await getDemoCompany();

  if (!company) {
    return NextResponse.redirect(new URL("/settings?quickbooks=no-company", request.url));
  }

  if (!hasQuickBooksEnv() || !code) {
    return NextResponse.redirect(new URL("/settings?quickbooks=export-mode", request.url));
  }

  if (!stateMatches(state, expectedState)) {
    const response = NextResponse.redirect(new URL("/settings?quickbooks=invalid-state", request.url));
    response.cookies.delete("strata_qb_oauth_state");
    return response;
  }

  const prisma = getPrisma();
  await prisma.integrationConnection.upsert({
    where: {
      companyId_provider: {
        companyId: company.id,
        provider: IntegrationProvider.quickbooks,
      },
    },
    update: {
      realmId,
      status: "sandbox_demo_callback_received",
      accessToken: null,
      refreshToken: null,
    },
    create: {
      companyId: company.id,
      provider: IntegrationProvider.quickbooks,
      realmId,
      status: "sandbox_demo_callback_received",
      accessToken: null,
      refreshToken: null,
    },
  });

  const response = NextResponse.redirect(new URL("/settings?quickbooks=demo-callback", request.url));
  response.cookies.delete("strata_qb_oauth_state");
  return response;
}
