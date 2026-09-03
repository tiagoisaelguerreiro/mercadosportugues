import type { Metadata } from "next";
import { Info, Store } from "lucide-react";
import { getCachedStats, getCachedSupermarketSummaries, getCachedSupermarkets } from "@/lib/data";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { SupermarketRanking } from "@/components/SupermarketRanking";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupermarketDot } from "@/components/ui/SupermarketDot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ranking de supermercados mais baratos",
  description:
    "Qual o supermercado mais barato em Portugal? Ranking diário do Continente, Pingo Doce, Auchan, Lidl, Aldi, Intermarché e Mercadona com índice de preço.",
  alternates: { canonical: "/supermercados" },
};

export default async function SupermarketsPage() {
  const [summaries, stats, all] = await Promise.all([
    getCachedSupermarketSummaries(),
    getCachedStats(),
    getCachedSupermarkets(),
  ]);
  const inactive = all.filter((s) => !s.isActive);
  const withData = summaries.filter((s) => s.offerCount > 0);

  return (
    <div className="space-y-10">
      <SectionHeading
        as="h1"
        eyebrow={
          <>
            <Store className="h-3.5 w-3.5" /> Supermercados
          </>
        }
        title="Qual é o supermercado mais barato?"
        description={`Ranking calculado sobre ${formatNumber(stats.productCount)} produtos comparáveis, com preços atualizados ${formatRelativeDay(stats.lastCapturedAt)}. Ordenado pela percentagem de produtos em que cada cadeia pratica o preço mais baixo.`}
      />

      {withData.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Ainda sem dados suficientes"
          description="O ranking aparece assim que existirem preços de pelo menos dois supermercados."
        />
      ) : (
        <SupermarketRanking summaries={withData} />
      )}

      <section className="grid gap-4 rounded-4xl border border-border bg-card/60 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
          <Info className="h-5 w-5" />
        </span>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Como ler este ranking</h2>
          <p>
            <strong className="text-foreground">Quota de mais barato</strong> — percentagem das ofertas de cada supermercado em que o
            seu preço é o mais baixo entre todas as cadeias que vendem o mesmo produto (empates contam para ambos).
          </p>
          <p>
            <strong className="text-foreground">Índice de preço</strong> — média dos preços do supermercado face à média de todas as
            cadeias para os mesmos produtos. 100 = igual à média; 95 significa cerca de 5% mais barato; 105, cerca de 5% mais caro.
          </p>
          <p>
            Só entram produtos disponíveis em pelo menos dois supermercados. Cadeias com poucos produtos comparáveis podem oscilar
            mais de dia para dia.
          </p>
        </div>
      </section>

      {inactive.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">Não monitorizados atualmente:</span>
          {inactive.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 opacity-70">
              <SupermarketDot supermarket={s} size="sm" />
              {s.name}
            </span>
          ))}
          <span>(Minipreço integrado na rede Auchan).</span>
        </p>
      )}
    </div>
  );
}
