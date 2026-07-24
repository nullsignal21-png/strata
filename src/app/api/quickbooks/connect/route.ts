import { NextResponse } from "next/server";
import { buildQuickBooksAuthUrl } from "@/lib/quickbooks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const state = crypto.randomUUID();
  const authUrl = buildQuickBooksAuthUrl(state);

  if (!authUrl) {
    return NextResponse.redirect(new URL("/settings?quickbooks=export-mode", request.url));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("strata_qb_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/api/quickbooks/callback",
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
  });
  return response;
}
