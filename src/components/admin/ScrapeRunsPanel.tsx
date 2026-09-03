"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FlaskConical, XCircle } from "lucide-react";
import type { ScrapeRun, Supermarket } from "@/lib/types";
import { formatDateTime, formatDuration, formatNumber, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { readApiError, useAdminToken } from "@/lib/use-admin-token";
import { AdminTokenBar } from "./AdminTokenBar";
import { Badge } from "@/components/ui/Badge";
import { SupermarketDot } from "@/components/ui/SupermarketDot";

interface Props {
  supermarkets: Supermarket[];
}

interface RunsResponse {
  count: number;
  runs: ScrapeRun[];
}

export function ScrapeRunsPanel({ supermarkets }: Props) {
  const { token, setToken, ready, authHeaders, hasToken } = useAdminToken();
  const [runs, setRuns] = useState<ScrapeRun[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/scrapes?limit=100", { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error(await readApiError(res, "Falha ao carregar execuções"));
      const data = (await res.json()) as RunsResponse;
      setRuns(data.runs);
      setStatus(`${data.count} execuç${data.count === 1 ? "ão" : "ões"} carregadas`);
    } catch (err) {
      setRuns(null);
      setStatus(err instanceof Error ? err.message : "Falha ao carregar execuções");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  // Carrega automaticamente quando ja existe token guardado na sessao.
  useEffect(() => {
    if (ready && hasToken && runs === null && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasToken]);

  const bySupermarket = useMemo(() => summarize(runs ?? [], supermarkets), [runs, supermarkets]);

  return (
    <div className="space-y-6">
      <AdminTokenBar
        token={token}
        onTokenChange={setToken}
        onSubmit={() => void load()}
        loading={loading}
        status={status}
        submitLabel="Carregar execuções"
      />

      {runs && runs.length > 0 && (
        <>
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground">
              <Activity className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              Estado por supermercado
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bySupermarket.map((row) => (
                <article
                  key={row.supermarket.id}
                  className={cn(
                    "rounded-3xl border bg-card p-4 shadow-soft",
                    row.health === "ok" && "border-border",
                    row.health === "warn" && "border-amber-300 dark:border-amber-800",
                    row.health === "bad" && "border-red-300 dark:border-red-800",
                    row.health === "none" && "border-dashed border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-bold text-foreground">
                      <SupermarketDot supermarket={row.supermarket} />
                      {row.supermarket.name}
                    </span>
                    <HealthBadge health={row.health} />
                  </div>
                  {row.last ? (
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-muted-foreground">Última execução</dt>
                      <dd className="text-right font-semibold text-foreground">{formatRelativeDay(row.last.startedAt)}</dd>
                      <dt className="text-muted-foreground">Produtos lidos</dt>
                      <dd className="text-right font-semibold text-foreground tabular">{formatNumber(row.last.productsReceived)}</dd>
                      <dt className="text-muted-foreground">Preços gravados</dt>
                      <dd className="text-right font-semibold text-foreground tabular">{formatNumber(row.last.pricePoints)}</dd>
                      <dt className="text-muted-foreground">Sucesso (7 exec.)</dt>
                      <dd className="text-right font-semibold text-foreground tabular">{row.successRate}%</dd>
                    </dl>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Sem execuções registadas.</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground">
              <Clock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              Histórico de execuções
            </h2>
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Início</th>
                      <th className="px-4 py-3">Supermercado</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Duração</th>
                      <th className="px-4 py-3 text-right">Lidos</th>
                      <th className="px-4 py-3 text-right">Novos</th>
                      <th className="px-4 py-3 text-right">Preços</th>
                      <th className="px-4 py-3 text-right">Match / Rev. / Órf.</th>
                      <th className="px-4 py-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {runs.map((run) => {
                      const sm = supermarkets.find((s) => s.id === run.supermarketId);
                      const duration =
                        run.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null;
                      return (
                        <tr key={run.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground tabular">{formatDateTime(run.startedAt)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                              {sm && <SupermarketDot supermarket={sm} size="sm" />}
                              {sm?.name ?? run.supermarketSlug}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <StatusBadge status={run.status} />
                              {run.dryRun && (
                                <Badge variant="outline">
                                  <FlaskConical className="h-3 w-3" /> dry-run
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular">{formatDuration(duration)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular">{formatNumber(run.productsReceived)}</td>
                          <td className="px-4 py-2.5 text-right tabular">{formatNumber(run.newMarketProducts)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular">{formatNumber(run.pricePoints)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular">
                            <span className="text-brand-700 dark:text-brand-300">{run.matched}</span> /{" "}
                            <span className="text-amber-700 dark:text-amber-300">{run.review}</span> /{" "}
                            <span className="text-red-600 dark:text-red-400">{run.orphan}</span>
                          </td>
                          <td className="max-w-[260px] truncate px-4 py-2.5 text-red-600 dark:text-red-400" title={run.errorMessage ?? undefined}>
                            {run.errorMessage ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {runs && runs.length === 0 && (
        <p className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Ainda não há execuções registadas. Corre <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run scrape</code>.
        </p>
      )}
    </div>
  );
}

type Health = "ok" | "warn" | "bad" | "none";

function summarize(runs: ScrapeRun[], supermarkets: Supermarket[]) {
  return supermarkets
    .filter((s) => s.isActive)
    .map((supermarket) => {
      const own = runs
        .filter((r) => r.supermarketId === supermarket.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const last = own[0] ?? null;
      const recent = own.slice(0, 7);
      const successRate = recent.length ? Math.round((recent.filter((r) => r.status === "success").length / recent.length) * 100) : 0;
      let health: Health = "none";
      if (last) {
        const ageDays = (Date.now() - new Date(last.startedAt).getTime()) / 86_400_000;
        if (last.status === "failed" || ageDays > 3) health = "bad";
        else if (successRate < 70 || ageDays > 1.5 || last.pricePoints === 0) health = "warn";
        else health = "ok";
      }
      return { supermarket, last, successRate, health };
    })
    .sort((a, b) => rank(a.health) - rank(b.health) || a.supermarket.name.localeCompare(b.supermarket.name, "pt-PT"));
}

function rank(h: Health): number {
  return h === "bad" ? 0 : h === "warn" ? 1 : h === "none" ? 2 : 3;
}

function HealthBadge({ health }: { health: Health }) {
  if (health === "ok")
    return (
      <Badge variant="brand">
        <CheckCircle2 className="h-3 w-3" /> saudável
      </Badge>
    );
  if (health === "warn")
    return (
      <Badge variant="amber">
        <AlertTriangle className="h-3 w-3" /> atenção
      </Badge>
    );
  if (health === "bad")
    return (
      <Badge variant="promo">
        <XCircle className="h-3 w-3" /> com falhas
      </Badge>
    );
  return <Badge variant="muted">sem dados</Badge>;
}

function StatusBadge({ status }: { status: ScrapeRun["status"] }) {
  if (status === "success") return <Badge variant="brand">sucesso</Badge>;
  if (status === "failed") return <Badge variant="promo">falhou</Badge>;
  return <Badge variant="info">a correr</Badge>;
}
