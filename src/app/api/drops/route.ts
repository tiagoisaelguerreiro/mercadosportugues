import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { buildCacheKey, cacheHeaders, publicApiCache } from "@/lib/api-cache";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

/** GET /api/drops?limit=8 — as maiores descidas de preco do dia. */
export async function GET(req: NextRequest) {
  const rateLimit = checkPublicRateLimit(req, "GET");
  if (rateLimit.response) return rateLimit.response;

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 8;
  const cached = await publicApiCache.getOrSet(
    buildCacheKey(["drops", limit]),
    async () => {
      const drops = await getRepository().biggestDrops(limit);
      return { count: drops.length, drops };
    },
  );

  const res = NextResponse.json(cached.value);
  for (const [key, value] of Object.entries(cacheHeaders(cached.hit))) {
    res.headers.set(key, value);
  }
  return appendRateLimitHeaders(res, rateLimit.result);
}
