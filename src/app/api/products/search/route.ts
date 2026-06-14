import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";

/**
 * GET /api/products/search?q=arroz&limit=20
 * Procura produtos globais e devolve os precos atuais em todos os
 * supermercados onde estao disponiveis, ordenados do mais barato ao mais caro.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

  const repo = getRepository();
  const results = await repo.search(q, limit);

  return NextResponse.json({
    query: q,
    count: results.length,
    results,
  });
}
