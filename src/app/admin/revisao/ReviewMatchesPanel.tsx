"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReviewMatch } from "@/lib/types";
import { ShieldAlert, CheckCircle2, XCircle, PlusCircle, ExternalLink } from "lucide-react";
import { readApiError, useAdminToken } from "@/lib/use-admin-token";
import { AdminTokenBar } from "@/components/admin/AdminTokenBar";
import { Badge } from "@/components/ui/Badge";
import { SupermarketDot } from "@/components/ui/SupermarketDot";

interface ReviewListResponse {
  count: number;
  matches: ReviewMatch[];
}

export function ReviewMatchesPanel() {
  const { token, setToken, ready, authHeaders, hasToken } = useAdminToken();
  const [matches, setMatches] = useState<ReviewMatch[] | null>(null);
  const [manualIds, setManualIds] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/matches/review?limit=50", { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error(await readApiError(res, "Falha ao carregar"));
      const list = (await res.json()) as ReviewListResponse;
      setMatches(list.matches);
      setStatus(`${list.count} match${list.count === 1 ? "" : "es"} em revisão`);
    } catch (err) {
      setMatches(null);
      setStatus(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (ready && hasToken && matches === null && !loading) void loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasToken]);

  async function runAction(productMarketId: number, action: "approve" | "reject" | "create-global", body?: unknown) {
    setBusyId(productMarketId);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/review/${productMarketId}/${action}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      if (!res.ok) throw new Error(await readApiError(res, "Ação falhou"));
      setMatches((current) => (current ?? []).filter((m) => m.productMarket.id !== productMarketId));
      setStatus("Revisão atualizada");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ação falhou");
    } finally {
      setBusyId(null);
    }
  }

  function approveManual(productMarketId: number) {
    const value = Number(manualIds[productMarketId]);
    if (!Number.isInteger(value) || value <= 0) {
      setStatus("Indica um ID de produto global válido");
      return;
    }
    void runAction(productMarketId, "approve", { productGlobalId: value });
  }

  return (
    <div className="space-y-6">
      <AdminTokenBar
        token={token}
        onTokenChange={setToken}
        onSubmit={() => void loadMatches()}
        loading={loading}
        status={status}
        submitLabel="Carregar pendentes"
      />

      <section className="space-y-4">
        {(matches ?? []).map((match) => {
          const busy = busyId === match.productMarket.id;
          return (
            <article key={match.productMarket.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:shadow-lift">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  {match.productMarket.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={match.productMarket.imageUrl}
                      alt=""
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] shrink-0 rounded-2xl bg-white object-contain ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="normal-case tracking-normal">
                        <SupermarketDot supermarket={match.supermarket} size="sm" />
                        {match.supermarket.name}
                      </Badge>
                      <span className="text-[11px] font-semibold text-muted-foreground">SKU {match.productMarket.marketSku}</span>
                      {match.productMarket.rawEan && (
                        <span className="text-[11px] font-semibold text-muted-foreground tabular">EAN {match.productMarket.rawEan}</span>
                      )}
                      <Badge variant={confidenceVariant(match.productMarket.matchConfidence)}>
                        {formatConfidence(match.productMarket.matchConfidence)}
                      </Badge>
                    </div>
                    <h2 className="mt-2 font-display text-lg font-extrabold tracking-tight text-foreground">
                      {match.productMarket.nameMarket}
                      {match.productMarket.productUrl && (
                        <a
                          href={match.productMarket.productUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="ml-2 inline-flex align-middle text-muted-foreground hover:text-brand-600"
                          aria-label="Abrir na loja"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </h2>
                    {match.suggestedProduct ? (
                      <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs">
                        <span className="font-bold text-muted-foreground">Sugestão: </span>
                        <strong className="text-foreground">
                          #{match.suggestedProduct.id} {match.suggestedProduct.brand ? `${match.suggestedProduct.brand} ` : ""}
                          {match.suggestedProduct.nameGlobal}
                        </strong>
                        {match.suggestedProduct.eanCode && (
                          <span className="ml-2 text-muted-foreground tabular">EAN {match.suggestedProduct.eanCode}</span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">Sem sugestão de produto global associada</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 sm:min-w-80">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={busy || !match.suggestedProduct}
                      onClick={() => void runAction(match.productMarket.id, "approve")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprovar sugestão
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(match.productMarket.id, "reject")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Rejeitar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="ID global manual"
                      value={manualIds[match.productMarket.id] ?? ""}
                      onChange={(e) => setManualIds((current) => ({ ...current, [match.productMarket.id]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-foreground outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveManual(match.productMarket.id)}
                      className="rounded-xl bg-foreground px-3 py-2 text-xs font-black uppercase tracking-wider text-background shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Associar
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(match.productMarket.id, "create-global", {
                        nameGlobal: match.productMarket.nameMarket,
                        eanCode: match.productMarket.rawEan,
                        imageUrl: match.productMarket.imageUrl,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Criar novo produto global
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && matches !== null && matches.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-brand-500" />
            <p className="font-bold text-foreground">Fila de revisão vazia</p>
            <p className="mt-1 text-xs">Todas as correspondências pendentes foram tratadas.</p>
          </div>
        )}

        {!loading && matches === null && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="font-bold text-foreground">Sem matches carregados</p>
            <p className="mt-1 text-xs">Introduz o token de administrador e clica em “Carregar pendentes”.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function formatConfidence(value: number | null): string {
  if (value == null) return "sem confiança";
  return `${Math.round(value * 100)}% confiança`;
}

function confidenceVariant(value: number | null): "brand" | "amber" | "promo" | "muted" {
  if (value == null) return "muted";
  if (value >= 0.85) return "brand";
  if (value >= 0.6) return "amber";
  return "promo";
}
