/**
 * Cliente HTTP resiliente para scraping "boa cidadania":
 *   - rotacao de User-Agents
 *   - delay aleatorio entre pedidos
 *   - retry com backoff exponencial
 *
 * Implementado sobre o fetch nativo do Node 18+ (sem dependencias).
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

export interface HttpClientOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
}

export class HttpClient {
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: HttpClientOptions = {}) {
    this.minDelayMs = opts.minDelayMs ?? Number(process.env.SCRAPER_MIN_DELAY_MS ?? 1500);
    this.maxDelayMs = opts.maxDelayMs ?? Number(process.env.SCRAPER_MAX_DELAY_MS ?? 4000);
    this.maxRetries = opts.maxRetries ?? Number(process.env.SCRAPER_MAX_RETRIES ?? 4);
    this.timeoutMs = opts.timeoutMs ?? Number(process.env.SCRAPER_TIMEOUT_MS ?? 60_000);
    this.defaultHeaders = {
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      Accept: "application/json, text/plain, */*",
      ...opts.defaultHeaders,
    };
  }

  private randomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private delay(): Promise<void> {
    const ms = this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(30_000, 2 ** attempt * 1000) + Math.random() * 500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(
    url: string,
    params: Record<string, string | number> | undefined,
    read: (res: Response) => Promise<T>,
  ): Promise<T> {
    const target = new URL(url);
    if (params) {
      for (const [k, v] of Object.entries(params)) target.searchParams.set(k, String(v));
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(target, {
          headers: {
            ...this.defaultHeaders,
            // Rotacao por defeito, mas respeita um User-Agent explicito
            // (ex.: OpenFoodFacts pede identificacao do projeto).
            "User-Agent": this.defaultHeaders["User-Agent"] ?? this.randomUserAgent(),
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new HttpStatusError(res.status, `HTTP ${res.status} em ${target.pathname}`);
        }
        const parsed = await read(res);
        await this.delay(); // boa cidadania entre pedidos bem sucedidos
        return parsed;
      } catch (err) {
        lastError = err;
        const retryable = err instanceof HttpStatusError ? err.retryable : true;
        if (retryable && attempt < this.maxRetries) {
          await this.backoff(attempt);
          continue;
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof HttpStatusError && !lastError.retryable) {
      throw lastError;
    }
    throw new Error(
      `Falha apos ${this.maxRetries} tentativas: ${target.toString()} — ${String(lastError)}`,
    );
  }

  async getJson<T = unknown>(url: string, params?: Record<string, string | number>): Promise<T> {
    return this.request(url, params, async (res) => (await res.json()) as T);
  }

  async getText(url: string, params?: Record<string, string | number>): Promise<string> {
    return this.request(url, params, (res) => res.text());
  }
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
