import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "reachable",
      demoMode: getEnv().DEMO_MODE === "true",
      demoCompanySlug: getEnv().DEMO_COMPANY_SLUG,
    });
  } catch (error) {
    logger.error("database_health_failure", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { ok: false, database: "unavailable", message: "Database check failed. Inspect Vercel runtime logs." },
      { status: 500 },
    );
  }
}
