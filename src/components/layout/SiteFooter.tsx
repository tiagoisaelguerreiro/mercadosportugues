import Link from "next/link";
import { getActiveSupermarkets, getCachedStats } from "@/lib/data";
import { formatRelativeDay } from "@/lib/format";
import { SupermarketDot } from "@/components/ui/SupermarketDot";
import { NAV_ITEMS } from "./nav-items";

export async function SiteFooter() {
  const [supermarkets, stats] = await Promise.all([
    getActiveSupermarkets().catch(() => []),
    getCachedStats().catch(() => null),
  ]);

  return (
    <footer className="mt-24 border-t border-border/60 bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 font-display text-base font-black text-white">
                M
              </span>
              <span className="font-display text-base font-extrabold tracking-tight text-foreground">
                Mercados<span className="text-brand-600 dark:text-brand-400">Portugues</span>
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Comparador independente de preços de supermercados em Portugal. Recolhemos os
              preços publicados online todos os dias e mostramos onde cada produto — e o teu
              carrinho completo — fica mais barato.
            </p>
            {stats && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
                Última atualização de preços: {formatRelativeDay(stats.lastCapturedAt)}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Navegar</h3>
            <ul className="mt-4 grid gap-2.5 text-sm font-semibold">
              <li>
                <Link href="/" className="text-foreground/80 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  Início
                </Link>
              </li>
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-foreground/80 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/admin" className="text-foreground/80 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  Painel admin
                </Link>
              </li>
              <li>
                <Link href="/privacidade" className="text-foreground/80 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  Privacidade e Termos
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Supermercados</h3>
            <ul className="mt-4 grid gap-2.5 text-sm font-semibold">
              {supermarkets.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/supermercado/${s.slug}`}
                    className="inline-flex items-center gap-2 text-foreground/80 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <SupermarketDot supermarket={s} size="sm" />
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border/50 pt-6 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MercadosPortugues. Projeto independente, sem ligação a qualquer cadeia de supermercados.</p>
          <p className="max-w-md sm:text-right">
            Preços recolhidos das lojas online para fins informativos; podem diferir dos praticados em loja e mudar sem aviso.
          </p>
        </div>
      </div>
    </footer>
  );
}
