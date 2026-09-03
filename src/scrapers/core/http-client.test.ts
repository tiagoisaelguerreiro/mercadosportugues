import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "@/scrapers/core/http-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(
  calls: Array<{ url: unknown; headers: Record<string, string> }>,
  payload: unknown = {},
) {
  vi.stubGlobal(
    "fetch",
    async (url: unknown, init: { headers?: Record<string, string> } = {}) => {
      calls.push({ url, headers: init.headers ?? {} });
      return { ok: true, status: 200, json: async () => payload } as Response;
    },
  );
}

describe("HttpClient User-Agent", () => {
  it("envia um User-Agent de navegador por defeito", async () => {
    const calls: Array<{ url: unknown; headers: Record<string, string> }> = [];
    stubFetch(calls);
    const http = new HttpClient({ minDelayMs: 0, maxDelayMs: 0 });
    await http.getJson("https://example.test/x");
    expect(calls).toHaveLength(1);
    expect(calls[0].headers["User-Agent"]).toMatch(/Mozilla/);
  });

  it("respeita um User-Agent explicito (ex.: OpenFoodFacts)", async () => {
    const calls: Array<{ url: unknown; headers: Record<string, string> }> = [];
    stubFetch(calls);
    const http = new HttpClient({
      minDelayMs: 0,
      maxDelayMs: 0,
      defaultHeaders: { "User-Agent": "MeuBot/1.0" },
    });
    await http.getJson("https://example.test/x");
    expect(calls[0].headers["User-Agent"]).toBe("MeuBot/1.0");
  });
});
