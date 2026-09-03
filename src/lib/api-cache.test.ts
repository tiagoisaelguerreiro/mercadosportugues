import { describe, expect, it } from "vitest";
import { buildCacheKey, TtlCache } from "@/lib/api-cache";

describe("TtlCache", () => {
  it("devolve hit antes do TTL e miss depois de expirar", () => {
    let now = 1_000;
    const cache = new TtlCache<string>(100, 10, () => now);

    cache.set("k", "valor");
    expect(cache.get("k")).toBe("valor");

    now = 1_101;
    expect(cache.get("k")).toBeNull();
  });

  it("reutiliza getOrSet quando a chave ainda esta em cache", async () => {
    let calls = 0;
    const cache = new TtlCache<number>(1_000);

    const first = await cache.getOrSet("n", async () => {
      calls++;
      return 1;
    });
    const second = await cache.getOrSet("n", async () => {
      calls++;
      return 2;
    });

    expect(first).toEqual({ hit: false, value: 1 });
    expect(second).toEqual({ hit: true, value: 1 });
    expect(calls).toBe(1);
  });

  it("remove a entrada mais antiga quando atinge o limite", () => {
    const cache = new TtlCache<string>(1_000, 2);
    cache.set("a", "A");
    cache.set("b", "B");
    cache.set("c", "C");

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("B");
    expect(cache.get("c")).toBe("C");
  });
});

describe("buildCacheKey", () => {
  it("gera chaves estaveis e seguras para parametros", () => {
    expect(buildCacheKey(["search", "leite meio-gordo", 20])).toBe(
      "search:leite%20meio-gordo:20",
    );
  });
});
