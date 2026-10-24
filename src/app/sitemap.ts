import type { MetadataRoute } from "next";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { basisUrl, oeffentlichePfade } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getTenantConfigServer();
  const basis = basisUrl(tenant.id);
  // Kein lastModified: Ohne belegtes Änderungsdatum wäre der Wert erfunden.
  return oeffentlichePfade(tenant.id).map((pfad) => ({ url: `${basis}${pfad}` }));
}
