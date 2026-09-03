import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, Database, EyeOff, FileText, Scale } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Privacidade e Termos",
  description:
    "Política de privacidade e termos de utilização do MercadosPortugues: que dados recolhemos (quase nenhuns), cookies e utilização aceitável.",
  alternates: { canonical: "/privacidade" },
};

const SECTIONS = [
  {
    icon: EyeOff,
    title: "Que dados recolhemos sobre ti",
    text: "Quase nenhuns. Não há contas, não há login, não há newsletter. O carrinho de compras fica guardado apenas no teu navegador (localStorage) e nunca é enviado para os nossos servidores, exceto quando carregas em comparar — nesse caso enviamos só os IDs dos produtos para calcular os totais, sem identificar quem és. Não usamos analytics de terceiros nem píxeis de rastreio.",
  },
  {
    icon: Cookie,
    title: "Cookies",
    text: "Usamos apenas o estritamente necessário ao funcionamento: preferência de tema claro/escuro e o token de administração (só para quem gere o site). Não há cookies de publicidade, nem de redes sociais, nem de medição. Por isso não precisas de banner de cookies para nos visitar.",
  },
  {
    icon: Database,
    title: "Dados que publicamos",
    text: "Publicamos preços recolhidos das lojas online dos supermercados (preço regular, promocional e preço por unidade), com a data de captura. São dados factuais e públicos, recolhidos uma vez por dia. Se és titular de direitos sobre algum conteúdo (ex.: uma fotografia) e queres pedir a remoção, diz-nos qual a página e tratamos disso.",
  },
  {
    icon: Scale,
    title: "Aviso sobre preços",
    text: "Os preços são informativos e podem diferir dos praticados em loja física, variar por região ou mudar sem aviso. Verifica sempre o preço final na loja antes de comprar. Não nos responsabilizamos por decisões de compra tomadas com base nestes dados, nem por indisponibilidade de produtos.",
  },
  {
    icon: FileText,
    title: "Utilização aceitável",
    text: "Podes usar o site livremente para comparar preços. Não é permitido fazer scraping massivo do site, contornar os limites de utilização da API pública, nem usar os dados para enganar terceiros. Reservamo-nos o direito de limitar acessos abusivos para proteger o serviço.",
  },
];

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeading
        as="h1"
        eyebrow="Transparência"
        title="Privacidade e Termos"
        description="Regras simples para um site simples: sem contas, sem rastreio, só preços."
      />
      <div className="mt-8 grid gap-4">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="rounded-2xl border border-border/60 bg-card p-5"
          >
            <h2 className="flex items-center gap-2.5 text-base font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <s.icon className="h-4 w-4" aria-hidden />
              </span>
              {s.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Dúvidas? Volta à página{" "}
        <Link href="/sobre" className="font-semibold text-brand-600 hover:underline">
          Como funciona
        </Link>
        .
      </p>
    </div>
  );
}
