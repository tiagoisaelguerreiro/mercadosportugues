import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { computePriceStats } from "@/db/query-logic";
import { buildCacheKey, cacheHeaders, publicApiCache } from "@/lib/api-cache";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/products/:id/history?days=30
 * Devolve o historico de precos dos ultimos N dias, agregado por supermercado,
 * pronto para alimentar o grafico de evolucao.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = checkPublicRateLimit(req, "GET");
  if (rateLimit.response) return rateLimit.response;

  const { id } = await params;
  const globalId = Number(id);
  if (!Number.isInteger(globalId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const daysParam = Number(searchParams.get("days") ?? 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;

  const cached = await publicApiCache.getOrSet(
    buildCacheKey(["product-history", globalId, days]),
    async () => {
      const repo = getRepository();
      const product = await repo.getProduct(globalId);
      if (!product) return null;

      const history = await repo.getHistory(globalId, days);
      return {
        productId: globalId,
        productName: product.product.nameGlobal,
        days,
        supermarkets: history.supermarkets,
        points: history.points,
        stats: computePriceStats(history.points, days),
      };
    },
  );

  if (!cached.value) {
    return NextResponse.json({ error: "produto nao encontrado" }, { status: 404 });
  }

  const res = NextResponse.json(cached.value);
  for (const [key, value] of Object.entries(cacheHeaders(cached.hit))) {
    res.headers.set(key, value);
  }
  return appendRateLimitHeaders(res, rateLimit.result);
}
