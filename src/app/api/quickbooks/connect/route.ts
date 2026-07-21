import { NextResponse } from "next/server";
import { buildQuickBooksAuthUrl } from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authUrl = buildQuickBooksAuthUrl(crypto.randomUUID());

  if (!authUrl) {
    return NextResponse.redirect(new URL("/settings?quickbooks=export-mode", request.url));
  }

  return NextResponse.redirect(authUrl);
}
