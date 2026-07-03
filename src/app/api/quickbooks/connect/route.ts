import { NextResponse } from "next/server";
import { buildQuickBooksAuthUrl } from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET() {
  const authUrl = buildQuickBooksAuthUrl(crypto.randomUUID());

  if (!authUrl) {
    return NextResponse.redirect(new URL("/settings?quickbooks=export-mode", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  return NextResponse.redirect(authUrl);
}
