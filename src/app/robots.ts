import type { MetadataRoute } from "next";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { basisUrl } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await getTenantConfigServer();
  // KI-Crawler bleiben bewusst zugelassen: Suche und Training sind erlaubt.
  // Interne Seiten nicht sperren, damit Crawler ihren noindex-Header sehen.
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${basisUrl(tenant.id)}/sitemap.xml`,
  };
}
