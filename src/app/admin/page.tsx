import type { Metadata } from "next";
import { CalendarClock, Database, Percent, ScanBarcode, Store } from "lucide-react";
import { dataSourceLabel, getCachedStats, getCachedSupermarkets } from "@/lib/data";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ScrapeRunsPanel } from "@/components/admin/ScrapeRunsPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const [stats, supermarkets] = await Promise.all([getCachedStats(), getCachedSupermarkets()]);
  const source = dataSourceLabel();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estado da plataforma e saúde do pipeline de recolha de preços.</p>
        </div>
        <Badge variant={source === "postgres" ? "brand" : "amber"} className="px-3 py-1 text-[11px]">
          Origem de dados: {source === "postgres" ? "PostgreSQL" : source === "live" ? "recolha real (ficheiro)" : "demo (memória)"}
        </Badge>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Produtos globais" value={formatNumber(stats.productCount)} icon={ScanBarcode} />
        <StatCard label="Ofertas com preço" value={formatNumber(stats.offerCount)} icon={Database} tone="brand" />
        <StatCard label="Em promoção" value={formatNumber(stats.promoCount)} icon={Percent} tone="amber" />
        <StatCard label="Supermercados ativos" value={stats.activeSupermarkets} icon={Store} />
        <StatCard
          label="Última captura"
          value={formatRelativeDay(stats.lastCapturedAt)}
          hint={stats.lastCapturedAt ?? "sem dados"}
          icon={CalendarClock}
          tone="dark"
        />
      </section>

      <ScrapeRunsPanel supermarkets={supermarkets} />
    </div>
  );
}
