// Zentrale SEO-Regeln je Marke: bevorzugte Domain, Sitemap-Inhalt und
// interne Bereiche ohne Indexierung. Framework-neutral, weil sowohl der
// Proxy als auch robots.ts/sitemap.ts und die Unit-Tests darauf zugreifen.

import { TENANTS, type TenantId } from "@/lib/tenant";

/** Bevorzugte Produktions-URL der Marke – Basis für Canonical, Sitemap und JSON-LD. */
export function basisUrl(id: TenantId): string {
  return `https://${TENANTS[id].domain}`;
}

/** Öffentliche Seiten für die Sitemap; /sportheim ist FCB-exklusiv. */
export function oeffentlichePfade(id: TenantId): string[] {
  const pfade = ["/", "/verein", "/mannschaften", "/news", "/kontakt", "/impressum", "/datenschutz"];
  return id === "fcb" ? [...pfade, "/sportheim"] : pfade;
}

/**
 * Interne Bereiche, die der Proxy mit `X-Robots-Tag: noindex` ausliefert.
 * Bewusst nicht per robots.txt gesperrt – sonst sähe der Crawler das noindex
 * nie. Ausnahme `/api`: zusätzlich per robots.txt gesperrt, weil dort ohnehin
 * kein Seiteninhalt liegt, der indexiert werden könnte. Der Zugriffsschutz
 * selbst bleibt bei RLS und den Rollen-Gates.
 */
export const NOINDEX_PFADE = [
  "/login", "/registrieren", "/confirm-email", "/auth", "/profil",
  "/mein-verein", "/platzbuchung", "/meine-buchungen", "/mitglieder",
  "/vorstandsbereich", "/kalender", "/vorstand", "/api",
] as const;

export function istNoindexPfad(pfad: string): boolean {
  return NOINDEX_PFADE.some((intern) => pfad === intern || pfad.startsWith(`${intern}/`));
}
