import { NextRequest, NextResponse } from "next/server";

type NowFn = () => number;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: NowFn = () => Date.now(),
    private readonly maxBuckets = 10_000,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    if (this.buckets.size >= this.maxBuckets) this.prune(now);
    const current = this.buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + this.windowMs };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const allowed = bucket.count <= this.limit;
    return {
      allowed,
      key,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  clear(): void {
    this.buckets.clear();
  }

  /** Numero de chaves ativas (para observabilidade/testes). */
  size(): number {
    return this.buckets.size;
  }

  /**
   * Remove buckets expirados; se continuar cheio, despeja os mais antigos
   * (o Map preserva ordem de insercao). Evita crescimento ilimitado de memoria
   * em processos de longa duracao.
   */
  prune(now: number = this.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size >= this.maxBuckets) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}

const publicWindowMs = envInt("API_RATE_LIMIT_WINDOW_MS", 60_000);

export const publicGetRateLimiter = new FixedWindowRateLimiter(
  envInt("API_RATE_LIMIT_GET_MAX", 120),
  publicWindowMs,
);

export const publicPostRateLimiter = new FixedWindowRateLimiter(
  envInt("API_RATE_LIMIT_POST_MAX", 30),
  publicWindowMs,
);

export function checkPublicRateLimit(
  req: NextRequest,
  kind: "GET" | "POST",
): { result: RateLimitResult; response: NextResponse | null } {
  const limiter = kind === "GET" ? publicGetRateLimiter : publicPostRateLimiter;
  const key = `${kind}:${clientIpFromHeaders(req.headers)}`;
  const result = limiter.check(key);
  return {
    result,
    response: result.allowed ? null : rateLimitResponse(result),
  };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    const ip = first?.trim();
    if (ip) return ip;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(result.retryAfterSeconds),
  };
}

export function appendRateLimitHeaders(res: NextResponse, result: RateLimitResult): NextResponse {
  for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
    res.headers.set(key, value);
  }
  return res;
}

function rateLimitResponse(result: RateLimitResult): NextResponse {
  const res = NextResponse.json(
    {
      error: "Demasiados pedidos. Tenta novamente dentro de alguns segundos.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429 },
  );
  return appendRateLimitHeaders(res, result);
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
