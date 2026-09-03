import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
        <SearchX className="h-10 w-10" />
      </div>
      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Erro 404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Página não encontrada</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        O produto ou página que procuras não existe ou foi removido do catálogo. Experimenta pesquisar:
      </p>
      <div className="mt-6">
        <SearchBar />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>
        <Link
          href="/pesquisa"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
        >
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}
