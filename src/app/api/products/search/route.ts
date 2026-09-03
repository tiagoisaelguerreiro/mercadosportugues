import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { buildCacheKey, cacheHeaders, publicApiCache } from "@/lib/api-cache";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/products/search?q=arroz&limit=20
 * Procura produtos globais e devolve os precos atuais em todos os
 * supermercados onde estao disponiveis, ordenados do mais barato ao mais caro.
 */
export async function GET(req: NextRequest) {
  const rateLimit = checkPublicRateLimit(req, "GET");
  if (rateLimit.response) return rateLimit.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

  const cached = await publicApiCache.getOrSet(
    buildCacheKey(["products-search", q.toLowerCase(), limit]),
    async () => {
      const repo = getRepository();
      const results = await repo.search(q, limit);
      return {
        query: q,
        count: results.length,
        results,
      };
    },
  );

  const res = NextResponse.json(cached.value);
  for (const [key, value] of Object.entries(cacheHeaders(cached.hit))) {
    res.headers.set(key, value);
  }
  return appendRateLimitHeaders(res, rateLimit.result);
}
