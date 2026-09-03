import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/matches/review?limit=50
 * Lista ofertas de mercado que precisam de revisao humana.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
  const matches = await getRepository().listReviewMatches(limit);

  return NextResponse.json({
    count: matches.length,
    matches,
  });
}
