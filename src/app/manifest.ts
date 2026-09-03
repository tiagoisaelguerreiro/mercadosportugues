import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MercadosPortugues — Comparador de preços de supermercados",
    short_name: "MercadosPT",
    description:
      "Compara diariamente os preços dos supermercados portugueses e descobre onde o teu carrinho fica mais barato.",
    start_url: "/",
    display: "standalone",
    lang: "pt-PT",
    background_color: "#f6faf8",
    theme_color: "#0b914b",
    categories: ["shopping", "finance", "utilities"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Promoções de hoje", url: "/promocoes" },
      { name: "O meu carrinho", url: "/carrinho" },
      { name: "Ranking de supermercados", url: "/supermercados" },
    ],
  };
}
