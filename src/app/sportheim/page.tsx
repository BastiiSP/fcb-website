import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Euro, ScrollText } from "lucide-react";

import { getTenant } from "@/lib/tenant.server";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import IconBadge from "@/components/ui/IconBadge";
import SportheimBereich from "@/components/sportheim/SportheimBereich";
import { getHeimspiele } from "@/lib/bfv";
import {
  SPORTHEIM_NUTZUNGSVORGABEN,
  SPORTHEIM_PREISE,
} from "@/lib/sportheim";

/**
 * Statischer `metadata`-Export wurde auf `generateMetadata()` umgestellt, weil die
 * Route markenexklusiv ist: auf dem JFG-Auftritt darf nicht der FCB-Sportheim-Titel
 * im <head> bzw. in der Tab-Beschriftung der 404-Antwort landen.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  if (tenant === "jfg") {
    return { title: "Seite nicht gefunden", robots: { index: false } };
  }

  return {
    title: "Sportheim mieten",
    alternates: { canonical: "/sportheim" },
    description:
      "Das Sportheim des 1. FC 1911 Burgkunstadt für private Feiern und Veranstaltungen unverbindlich anfragen – mit Belegungskalender und Preisen.",
  };
}

// Heimspiele ändern sich selten → stündliches Caching wie die übrige BFV-Anbindung
export const revalidate = 3600;

// Öffentliche Sportheim-Seite – Server Component, bewusst ohne Auth-Check:
// jede und jeder darf die Belegung sehen und unverbindlich anfragen.
export default async function SportheimSeite() {
  // Das Sportheim ist FCB-Anlagenverwaltung. Auf dem JFG-Auftritt existiert dieser
  // Pfad nicht – die Absicherung sitzt bewusst hier (nicht nur in der Nav), damit
  // auch der direkte URL-Aufruf sauber mit 404 endet statt FCB-Inhalte auszuliefern.
  if ((await getTenant()) === "jfg") {
    notFound();
  }

  const heimspiele = await getHeimspiele();

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Sportheim"
        subtitle="Unser Sportheim am Alten Postweg für private Feiern und Veranstaltungen – unverbindlich anfragen"
      />

      {/* Preise & Nutzungsvorgaben – Inhalte werden in src/lib/sportheim.ts gepflegt */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <IconBadge icon={Euro} accent="brand" size="md" label="Preise" />
            <h2 className="font-oswald text-xl font-semibold uppercase tracking-wide text-fcb-text">
              Preise
            </h2>
          </div>
          <ul className="space-y-3">
            {SPORTHEIM_PREISE.map((position) => (
              <li
                key={position.leistung}
                className="flex items-baseline justify-between gap-4 border-b border-fcb-border pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="font-inter text-sm font-medium text-fcb-text">
                    {position.leistung}
                  </p>
                  {position.hinweis && (
                    <p className="font-inter text-xs text-fcb-muted">
                      {position.hinweis}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-inter text-sm font-semibold text-fcb-text">
                  {position.preis}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-3">
            <IconBadge
              icon={ScrollText}
              accent="brand"
              size="md"
              label="Nutzungsvorgaben"
            />
            <h2 className="font-oswald text-xl font-semibold uppercase tracking-wide text-fcb-text">
              Nutzungsvorgaben
            </h2>
          </div>
          <ul className="list-disc space-y-2 pl-5">
            {SPORTHEIM_NUTZUNGSVORGABEN.map((vorgabe) => (
              <li key={vorgabe} className="font-inter text-sm text-fcb-muted">
                {vorgabe}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Belegungskalender + Anfrageformular (Client-Teil) */}
      <SportheimBereich heimspiele={heimspiele} />
    </PageShell>
  );
}
