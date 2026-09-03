type NowFn = () => number;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries = 500,
    private readonly now: NowFn = () => Date.now(),
  ) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.pruneExpired();
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: this.now() + ttlMs,
    });
  }

  async getOrSet(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<{
    hit: boolean;
    value: T;
  }> {
    const cached = this.get(key);
    if (cached != null) return { hit: true, value: cached };

    const value = await loader();
    this.set(key, value, ttlMs);
    return { hit: false, value };
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    this.pruneExpired();
    return this.store.size;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}

export interface CacheEnvelope<T> {
  hit: boolean;
  value: T;
}

export const publicApiCache = new TtlCache<unknown>(
  envSeconds("API_CACHE_TTL_SECONDS", 60) * 1000,
  envInt("API_CACHE_MAX_ENTRIES", 500),
);

export function buildCacheKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.map((part) => encodeURIComponent(String(part ?? ""))).join(":");
}

export function cacheHeaders(hit: boolean, ttlSeconds = envSeconds("API_CACHE_TTL_SECONDS", 60)) {
  return {
    "Cache-Control": `public, max-age=${ttlSeconds}`,
    "X-Cache": hit ? "HIT" : "MISS",
  };
}

function envSeconds(name: string, fallback: number): number {
  return envInt(name, fallback);
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
