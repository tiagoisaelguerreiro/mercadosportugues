import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/data";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/admin/", "/carrinho?*", "/pesquisa?*"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
