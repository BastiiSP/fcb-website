import type { Metadata } from "next";
import StartseiteClient from "@/components/startseite/StartseiteClient";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { erstelleStartseitenJsonLd } from "@/lib/strukturierteDaten";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  return {
    title: { absolute: tenant.startseitenTitel },
    description: tenant.metaDescription,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const tenant = await getTenantConfigServer();
  const daten = erstelleStartseitenJsonLd(tenant.id);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(daten).replace(/</g, "\\u003c") }}
      />
      <StartseiteClient />
    </>
  );
}
