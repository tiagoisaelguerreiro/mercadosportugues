import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, FixedWindowRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("bloqueia pedidos acima do limite dentro da janela", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 1_000, () => now);

    expect(limiter.check("ip").allowed).toBe(true);
    const second = limiter.check("ip");
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = limiter.check("ip");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(1);

    now = 2_001;
    const afterReset = limiter.check("ip");
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it("isola contadores por chave", () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("expira buckets antigos no prune (sem fuga de memoria)", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(10, 1_000, () => now);
    limiter.check("a");
    limiter.check("b");
    expect(limiter.size()).toBe(2);

    now = 5_000; // janela (1000ms) ja expirou para ambas
    limiter.prune();
    expect(limiter.size()).toBe(0);
  });

  it("despeja os mais antigos quando o mapa esta cheio", () => {
    const limiter = new FixedWindowRateLimiter(1_000, 60_000, () => 1_000, 2);
    limiter.check("a");
    limiter.check("b");
    expect(limiter.size()).toBe(2);
    limiter.check("c"); // dispara prune + eviccao
    expect(limiter.size()).toBeLessThanOrEqual(2);
    expect(limiter.check("c").allowed).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("usa o primeiro IP de x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    expect(clientIpFromHeaders(headers)).toBe("1.1.1.1");
  });

  it("usa x-real-ip quando x-forwarded-for nao existe", () => {
    const headers = new Headers({ "x-real-ip": "3.3.3.3" });
    expect(clientIpFromHeaders(headers)).toBe("3.3.3.3");
  });

  it("usa fallback anonimo quando nao ha headers de IP", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("rateLimitHeaders", () => {
  it("gera headers HTTP uteis", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      key: "GET:1.1.1.1",
      limit: 10,
      remaining: 0,
      resetAt: 2_000,
      retryAfterSeconds: 2,
    });

    expect(headers).toMatchObject({
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "2",
      "Retry-After": "2",
    });
  });
});
