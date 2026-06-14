import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MercadosPortugues — Comparador de preços de supermercados",
  description:
    "Compara diariamente os preços do Continente, Pingo Doce, Aldi, Intermarché, Lidl e Auchan. Encontra o supermercado mais barato para cada produto e para o teu carrinho.",
  keywords: ["supermercados", "preços", "Portugal", "comparador", "poupança"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-white">
                M
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                Mercados<span className="text-brand-600">Portugues</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
              <Link href="/" className="hover:text-brand-600">
                Início
              </Link>
              <Link href="/carrinho" className="hover:text-brand-600">
                Carrinho
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-gray-500">
            <p>
              MercadosPortugues — comparação diária de preços. Dados recolhidos para fins
              informativos; preços reais podem variar por loja e disponibilidade.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
