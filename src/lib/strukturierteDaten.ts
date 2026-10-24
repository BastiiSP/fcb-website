// Strukturierte Daten (JSON-LD) der Startseite je Marke: WebSite für den
// Website-Namen in Google, SportsOrganization für die Vereinsidentität.
// Werte kommen ausschließlich aus tenant.ts und rechtstexte.ts – keine
// Vereinsfakten hier ergänzen. Einziger Domain-Querverweis ist die belegte
// Trägerbeziehung (FCB memberOf JFG, JFG member FCB), damit Such- und
// KI-Systeme beide eigenständigen Vereine auseinanderhalten.

import { RECHTSTEXTE } from "@/lib/rechtstexte";
import { basisUrl } from "@/lib/seo";
import { TENANTS, type TenantId } from "@/lib/tenant";

interface OrganisationsVerweis {
  "@type": "SportsOrganization";
  name: string;
  url?: string;
}

interface Postadresse {
  "@type": "PostalAddress";
  streetAddress?: string;
  postalCode: string;
  addressLocality: string;
  addressCountry: "DE";
}

interface WebsiteDaten {
  "@type": "WebSite";
  "@id": string;
  name: string;
  alternateName: string[];
  url: string;
  inLanguage: "de-DE";
  publisher: { "@id": string };
}

interface OrganisationsDaten {
  "@type": "SportsOrganization";
  "@id": string;
  name: string;
  alternateName: string[];
  legalName: string;
  url: string;
  logo: string;
  foundingDate: string;
  sport: "Fußball";
  sameAs: string[];
  email: string;
  address: Postadresse;
  memberOf?: OrganisationsVerweis;
  member?: OrganisationsVerweis[];
}

interface StartseitenJsonLd {
  "@context": "https://schema.org";
  "@graph": [WebsiteDaten, OrganisationsDaten];
}

export function erstelleStartseitenJsonLd(id: TenantId): StartseitenJsonLd {
  const tenant = TENANTS[id];
  const recht = RECHTSTEXTE[id];
  const basis = basisUrl(id);
  const [postalCode, ...ortTeile] = recht.ort.split(" ");
  const adresse: Postadresse = {
    "@type": "PostalAddress",
    postalCode,
    addressLocality: ortTeile.join(" "),
    addressCountry: "DE",
  };
  // JFG nur mit PLZ/Ort: Die Vereinsanschrift ist keine Sportstätte, die
  // Straße bleibt aus Datenminimierung im Impressum statt in Suchergebnissen.
  if (id === "fcb") adresse.streetAddress = recht.strasse;

  const website: WebsiteDaten = {
    "@type": "WebSite",
    "@id": `${basis}/#website`,
    name: tenant.name,
    alternateName: [...tenant.alternativeNamen, tenant.domain.replace(/^www\./, "")],
    url: `${basis}/`,
    inLanguage: "de-DE",
    publisher: { "@id": `${basis}/#organisation` },
  };
  const organisation: OrganisationsDaten = {
    "@type": "SportsOrganization",
    "@id": `${basis}/#organisation`,
    name: tenant.name,
    alternateName: tenant.alternativeNamen,
    legalName: tenant.vereinsname,
    url: `${basis}/`,
    logo: `${basis}${tenant.logoPngSrc}`,
    foundingDate: tenant.gruendungsjahr,
    sport: "Fußball",
    sameAs: tenant.profilUrls,
    email: recht.email,
    address: adresse,
  };
  // Keine Telefonnummer: Die FCB-Nummer ist für strukturierte Daten noch ungeklärt.
  if (id === "fcb") {
    organisation.memberOf = {
      "@type": "SportsOrganization",
      name: TENANTS.jfg.name,
      url: `${basisUrl("jfg")}/`,
    };
  } else {
    // URL nur für Trägervereine mit eigenem Auftritt in dieser Codebasis –
    // für die anderen beiden keine Domain erfinden.
    organisation.member = tenant.traegervereine.map((verein) => {
      const eigenerAuftritt = (Object.keys(TENANTS) as TenantId[]).find(
        (andere) => TENANTS[andere].name === verein.name,
      );
      return {
        "@type": "SportsOrganization",
        name: verein.name,
        ...(eigenerAuftritt ? { url: `${basisUrl(eigenerAuftritt)}/` } : {}),
      };
    });
  }

  return { "@context": "https://schema.org", "@graph": [website, organisation] };
}
