import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fixa a raiz do workspace neste projeto (evita deteccao de lockfiles externos).
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.continente.pt" },
      { protocol: "https", hostname: "**.pingodoce.pt" },
      { protocol: "https", hostname: "**.auchan.pt" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
