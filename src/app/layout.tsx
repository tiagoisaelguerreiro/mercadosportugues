import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { siteUrl } from "@/lib/data";

// Todas as paginas dependem de dados que mudam diariamente (e, em producao, da
// base de dados): nunca pre-renderizar em build.
export const dynamic = "force-dynamic";

const SITE_NAME = "MercadosPortugues";
const DESCRIPTION =
  "Compara diariamente os preços do Continente, Pingo Doce, Auchan, Lidl, Aldi, Intermarché e Mercadona. Descobre o supermercado mais barato para cada produto e para o teu carrinho completo.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Comparador diário de preços de supermercados`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
  keywords: [
    "supermercados",
    "preços",
    "comparador de preços",
    "Portugal",
    "poupança",
    "Continente",
    "Pingo Doce",
    "Auchan",
    "Lidl",
    "Mercadona",
    "cabaz",
  ],
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Comparador diário de preços de supermercados`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Comparador diário de preços`,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteHeader />
          <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
