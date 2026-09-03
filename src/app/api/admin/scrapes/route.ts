import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { requireAdmin } from "@/lib/admin-auth";
import { intParam } from "@/lib/api-route";

/**
 * GET /api/admin/scrapes?limit=50
 * Historico de execucoes do pipeline de scraping (uma linha por adapter/dia).
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const limit = intParam(searchParams, "limit", 50, 1, 200);
  const runs = await getRepository().listScrapeRuns(limit);

  return NextResponse.json({ count: runs.length, runs }, { headers: { "Cache-Control": "no-store" } });
}
