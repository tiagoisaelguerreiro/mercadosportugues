import Link from "next/link";
import { BasketLink } from "@/components/BasketLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Saltar para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="MercadosPortugues — início">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-lg font-black text-white shadow-sm shadow-brand-900/20 transition-transform group-hover:scale-105">
            M
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-extrabold tracking-tight text-foreground">
              Mercados<span className="text-brand-600 dark:text-brand-400">Portugues</span>
            </span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              Comparador diário de preços
            </span>
          </span>
        </Link>

        <MainNav />

        <div className="flex items-center gap-2">
          <BasketLink />
          <ThemeToggle className="hidden md:inline-flex" />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
