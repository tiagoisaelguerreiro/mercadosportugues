import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fixa a raiz do workspace neste projeto (evita deteccao de lockfiles externos).
  outputFileTracingRoot: import.meta.dirname,
  // Build autonomo para a imagem Docker (ver Dockerfile).
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    // CSP intencionalmente permissiva em script/style inline: o Next.js e o
    // Recharts precisam; o essencial (anti-clickjacking, anti-MIME-sniffing,
    // HSTS) vai nos headers dedicados. Apertar script-src exige nonces (futuro).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  images: {
    // Apenas CDNs/lojas reais (fotos do scraper). Sem wildcard: novos dominios
    // entram aqui explicitamente apos revisao.
    remotePatterns: [
      { protocol: "https", hostname: "**.continente.pt" },
      { protocol: "https", hostname: "**.pingodoce.pt" },
      { protocol: "https", hostname: "static.pingodoce.pt" },
      { protocol: "https", hostname: "**.auchan.pt" },
      { protocol: "https", hostname: "**.minipreco.pt" },
      { protocol: "https", hostname: "**.lidl.pt" },
      { protocol: "https", hostname: "**.aldi.pt" },
      { protocol: "https", hostname: "**.intermarche.pt" },
      { protocol: "https", hostname: "**.mercadona.pt" },
      { protocol: "https", hostname: "**.mercadona.es" },
      { protocol: "https", hostname: "prod-mercadona.imgix.net" },
    ],
  },
};

export default nextConfig;
