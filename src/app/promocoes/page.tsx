import type { Metadata } from "next";
import { TicketPercent } from "lucide-react";
import { getRepository } from "@/db/repository";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { BiggestDrops } from "@/components/BiggestDrops";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { parseBrowseSearchParams, type SearchParamsRecord } from "@/lib/browse-url";
import { getCachedStats } from "@/lib/data";
import { formatNumber, formatRelativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promoções de hoje nos supermercados",
  description:
    "Todas as promoções ativas no Continente, Pingo Doce, Auchan, Lidl, Aldi, Intermarché e Mercadona, ordenadas pelo maior desconto.",
  alternates: { canonical: "/promocoes" },
};

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const state = parseBrowseSearchParams(await searchParams);
  const [drops, stats] = await Promise.all([getRepository().biggestDrops(8), getCachedStats()]);

  return (
    <div className="space-y-12">
      <SectionHeading
        as="h1"
        eyebrow={
          <>
            <TicketPercent className="h-3.5 w-3.5" /> Promoções
          </>
        }
        title="Promoções ativas hoje"
        description={`${formatNumber(stats.promoCount)} ofertas em promoção em ${stats.activeSupermarkets} supermercados. Preços atualizados ${formatRelativeDay(stats.lastCapturedAt)}.`}
      />

      <BiggestDrops drops={drops} />

      <CatalogBrowser
        basePath="/promocoes"
        state={state}
        locked={{ onlyPromo: true }}
        defaultSort="promo"
        heading={
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Todos os produtos em promoção
          </h2>
        }
      />
    </div>
  );
}
