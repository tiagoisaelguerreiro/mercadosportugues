import { NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { loadLiveCatalog } from "@/db/live-catalog";
import { version as appVersion } from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Verificacao de saude para load balancers / uptime monitors. Devolve 200 se a
 * origem de dados responde e indica ha quantos dias foi a ultima recolha
 * (`stale: true` quando ha mais de 2 dias sem precos novos).
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const stats = await getRepository().getStats();
    const lastCaptured = stats.lastCapturedAt ? new Date(stats.lastCapturedAt) : null;
    const ageDays = lastCaptured
      ? Math.floor((Date.now() - lastCaptured.getTime()) / 86_400_000)
      : null;
    const stale = ageDays == null || ageDays > 2;

    return NextResponse.json(
      {
        status: stale ? "degraded" : "ok",
        version: appVersion,
        dataSource: process.env.USE_DB === "true" ? "postgres" : loadLiveCatalog() ? "live" : "memory",
        lastCapturedAt: stats.lastCapturedAt,
        dataAgeDays: ageDays,
        stale,
        offers: stats.offerCount,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
