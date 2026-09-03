import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { buildCacheKey, cacheHeaders, publicApiCache } from "@/lib/api-cache";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

/** GET /api/products/:id — produto global com todas as ofertas. */
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
  const cached = await publicApiCache.getOrSet(
    buildCacheKey(["product", globalId]),
    () => getRepository().getProduct(globalId),
  );
  const product = cached.value;
  if (!product) {
    return NextResponse.json({ error: "produto nao encontrado" }, { status: 404 });
  }
  const res = NextResponse.json(product);
  for (const [key, value] of Object.entries(cacheHeaders(cached.hit))) {
    res.headers.set(key, value);
  }
  return appendRateLimitHeaders(res, rateLimit.result);
}
