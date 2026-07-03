import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { hasQuickBooksEnv } from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const company = await getDemoCompany();

  if (!company) {
    return NextResponse.redirect(new URL("/settings?quickbooks=no-company", request.url));
  }

  if (!hasQuickBooksEnv() || !code) {
    return NextResponse.redirect(new URL("/settings?quickbooks=export-mode", request.url));
  }

  await prisma.integrationConnection.upsert({
    where: {
      companyId_provider: {
        companyId: company.id,
        provider: IntegrationProvider.quickbooks,
      },
    },
    update: {
      realmId,
      status: "sandbox_authorized",
      accessToken: null,
      refreshToken: null,
    },
    create: {
      companyId: company.id,
      provider: IntegrationProvider.quickbooks,
      realmId,
      status: "sandbox_authorized",
      accessToken: null,
      refreshToken: null,
    },
  });

  return NextResponse.redirect(new URL("/settings?quickbooks=connected", request.url));
}
