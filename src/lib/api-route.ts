import { NextRequest, NextResponse } from "next/server";
import { buildCacheKey, cacheHeaders, publicApiCache } from "@/lib/api-cache";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

/**
 * Executa um GET publico com rate limiting + cache TTL em memoria, devolvendo
 * JSON com os headers `Cache-Control`, `X-Cache` e `X-RateLimit-*`.
 *
 * Centraliza o padrao repetido em todas as rotas publicas de leitura.
 */
export async function cachedJsonGet<T>(
  req: NextRequest,
  keyParts: Array<string | number | boolean | null | undefined>,
  loader: () => Promise<T>,
  opts: { notFound?: (value: T) => boolean } = {},
): Promise<NextResponse> {
  const rateLimit = checkPublicRateLimit(req, "GET");
  if (rateLimit.response) return rateLimit.response;

  const cached = await publicApiCache.getOrSet(buildCacheKey(keyParts), loader);
  if (opts.notFound?.(cached.value as T)) {
    return appendRateLimitHeaders(
      NextResponse.json({ error: "nao encontrado" }, { status: 404 }),
      rateLimit.result,
    );
  }

  const res = NextResponse.json(cached.value);
  for (const [key, value] of Object.entries(cacheHeaders(cached.hit))) {
    res.headers.set(key, value);
  }
  return appendRateLimitHeaders(res, rateLimit.result);
}

/** Le um inteiro de query string com limites e valor por defeito. */
export function intParam(
  searchParams: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = searchParams.get(name);
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

export function boolParam(searchParams: URLSearchParams, name: string): boolean {
  const raw = searchParams.get(name);
  return raw === "1" || raw === "true";
}
