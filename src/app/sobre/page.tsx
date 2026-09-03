import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  Database,
  Link2,
  ScanBarcode,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
} from "lucide-react";
import { getActiveSupermarkets, getCachedStats } from "@/lib/data";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatCard } from "@/components/ui/StatCard";
import { SupermarketChip } from "@/components/ui/SupermarketDot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como o MercadosPortugues recolhe, compara e apresenta diariamente os preços dos supermercados portugueses.",
  alternates: { canonical: "/sobre" },
};

const STEPS = [
  {
    icon: CalendarClock,
    title: "Recolha automática todas as manhãs",
    text: "Um processo agendado visita as lojas online de cada supermercado, percorre as categorias e regista o preço regular, o preço promocional e o preço por unidade de cada artigo. Cada execução fica registada com o número de produtos lidos e eventuais erros.",
  },
  {
    icon: ScanBarcode,
    title: "Correspondência de produtos entre cadeias",
    text: "O mesmo produto tem nomes diferentes em cada loja. Ligamo-los primeiro pelo código de barras (EAN) e, quando não existe, por semelhança de nome, marca e quantidade. Correspondências com confiança baixa vão para revisão manual antes de serem publicadas.",
  },
  {
    icon: Database,
    title: "Histórico completo de preços",
    text: "Cada preço fica guardado com a data de captura. É isso que permite mostrar a evolução ao longo do tempo, detetar descidas reais (e não apenas promoções anunciadas) e calcular mínimos, máximos e médias.",
  },
  {
    icon: BarChart3,
    title: "Comparação e ranking",
    text: "Para cada produto mostramos o preço em todos os supermercados onde está disponível. Agregando tudo, calculamos em que percentagem de produtos cada cadeia é a mais barata e um índice de preço face à média.",
  },
  {
    icon: ShoppingBasket,
    title: "Carrinho comparado",
    text: "Adiciona os produtos que compras habitualmente e vê o total em cada supermercado, com indicação dos artigos em falta em cada um e do cabaz completo mais barato.",
  },
];

const FAQ = [
  {
    q: "Os preços são os mesmos das lojas físicas?",
    a: "Não necessariamente. Recolhemos os preços publicados nas lojas online, que podem diferir dos praticados em loja e variar por região. Usa-os como referência para decidir onde comprar. A Mercadona usa o catálogo da loja online ibérica (mercadona.es), porque o site português não expõe um catálogo público.",
  },
  {
    q: "Com que frequência os dados são atualizados?",
    a: "Uma vez por dia, de manhã. A data da última recolha aparece na página inicial e no rodapé. Se um supermercado falhar num dia, mantemos o último preço conhecido e assinalamos a data.",
  },
  {
    q: "Porque é que alguns produtos só aparecem num supermercado?",
    a: "Marcas próprias (ex.: Continente, Pingo Doce) não existem nas outras cadeias. Só comparamos produtos idênticos — não substituímos marcas nem tamanhos diferentes.",
  },
  {
    q: "Como é calculado o índice de preço?",
    a: "Para cada produto disponível em pelo menos dois supermercados, dividimos o preço de cada cadeia pela média das cadeias. O índice é a média desses rácios × 100: abaixo de 100 é mais barato que a média.",
  },
  {
    q: "Tem alguma ligação aos supermercados?",
    a: "Nenhuma. O projeto é independente, não recebe comissões e não favorece nenhuma cadeia. As ligações para as lojas servem apenas para consultar o produto na origem.",
  },
];

export default async function AboutPage() {
  const [stats, supermarkets] = await Promise.all([getCachedStats(), getActiveSupermarkets()]);

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-10">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5" /> Como funciona
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-foreground text-balance sm:text-5xl">
            Preços reais dos supermercados, comparados todos os dias.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            O MercadosPortugues é um comparador independente. Não vendemos nada nem recebemos comissões: apenas
            recolhemos os preços publicados pelos supermercados e organizamo-los para que possas decidir onde
            comprar com informação transparente.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {supermarkets.map((s) => (
              <SupermarketChip key={s.id} supermarket={s} href={`/supermercado/${s.slug}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos comparados" value={formatNumber(stats.productCount)} icon={ScanBarcode} />
        <StatCard label="Preços monitorizados" value={formatNumber(stats.offerCount)} icon={Database} tone="brand" />
        <StatCard label="Supermercados" value={stats.activeSupermarkets} icon={Store} />
        <StatCard
          label="Última recolha"
          value={formatRelativeDay(stats.lastCapturedAt)}
          hint={stats.lastCapturedAt ?? undefined}
          icon={CalendarClock}
          tone="dark"
        />
      </section>

      <section className="space-y-6">
        <SectionHeading title="Da loja online até ao teu ecrã" description="Cinco passos, repetidos todos os dias." />
        <ol className="grid gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:grid-cols-[auto_1fr] sm:p-6">
              <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Passo {i + 1}</span>
              </div>
              <div>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6">
        <SectionHeading title="Perguntas frequentes" />
        <div className="grid gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-3xl border border-border bg-card shadow-soft open:border-brand-300 dark:open:border-brand-800">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="shrink-0 text-muted-foreground transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-4xl border border-border bg-card/60 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Dados abertos e API</h2>
          <p>
            Os dados públicos estão disponíveis em JSON para uso não comercial:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">/api/products/search?q=leite</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">/api/products/browse</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">/api/drops</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">/api/supermarkets</code> e{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">/api/stats</code>. Existe um limite de pedidos por
            minuto por endereço.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            <Link href="/pesquisa" className="font-bold text-brand-700 hover:underline dark:text-brand-300">
              Começar a comparar
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
