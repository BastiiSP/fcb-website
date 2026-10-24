import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import IconBadge from "@/components/ui/IconBadge";
import ButtonLink from "@/components/ui/ButtonLink";
import Banner from "@/components/ui/Banner";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { VEREINS_TEXTE, type VereinsTextblock } from "@/lib/vereinstexte";

// Öffentliche Vereinsseite – Server Component, kein Auth-Check.
// Die Seite ist markenabhängig: Struktur und Optik sind für FCB und JFG
// identisch, die Inhalte kommen aus VEREINS_TEXTE (src/lib/vereinstexte.ts).
//
// FCB-Fakten: Gründung 1911, ~450 Mitglieder, Schwarz-Weiß, Alter Postweg 10,
// 1. Vorsitzender Wolfgang Strassgürtel, Jugend A–D in der JFG Kunstadt-Obermain.
// JFG-Inhalte sind aktuell durchgehend Platzhalter (siehe vereinstexte.ts).

// Titel und Beschreibung hängen an der Marke – deshalb generateMetadata()
// statt statischem metadata-Export.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  const texte = VEREINS_TEXTE[tenant.id];
  return {
    title: texte.metaTitel,
    alternates: { canonical: "/verein" },
    description: texte.metaBeschreibung,
  };
}

/** Einheitliche Section-Überschrift der Vereinsseite. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 mt-12 font-oswald text-2xl font-semibold uppercase tracking-wide text-fcb-text first:mt-0">
      {children}
    </h2>
  );
}

/**
 * Fließtext-Abschnitt. Ist ein `platzhalterHinweis` gesetzt, steht der Hinweis
 * als Info-Banner über dem Text – so ist der offene Redaktionsstand direkt in
 * der UI sichtbar und nicht nur im Code vermerkt.
 */
function Textabschnitt({ block }: { block: VereinsTextblock }) {
  return (
    <>
      <SectionHeading>{block.heading}</SectionHeading>
      <div className="max-w-2xl space-y-4 font-inter text-base leading-relaxed text-fcb-text/80">
        {block.platzhalterHinweis && (
          <Banner variant="info" message={block.platzhalterHinweis} />
        )}
        {block.absaetze.map((absatz) => (
          <p key={absatz}>{absatz}</p>
        ))}
      </div>
    </>
  );
}

export default async function VereinPage() {
  const tenant = await getTenantConfigServer();
  const texte = VEREINS_TEXTE[tenant.id];
  const { ansprechpartner } = texte;

  return (
    <PageShell maxWidth="xl">
      <PageHeader title={texte.titel} subtitle={texte.untertitel} />

      <Textabschnitt block={texte.werWirSind} />

      <Textabschnitt block={texte.geschichte} />

      <SectionHeading>{texte.faktenHeading}</SectionHeading>
      {texte.faktenPlatzhalterHinweis && (
        <div className="mb-4 max-w-2xl">
          <Banner variant="info" message={texte.faktenPlatzhalterHinweis} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {texte.fakten.map(({ icon, wert, text }) => (
          <Card key={wert} className="flex items-center gap-4">
            <IconBadge icon={icon} accent="brand" size="lg" />
            <div>
              <p className="font-oswald text-xl font-semibold text-fcb-text">{wert}</p>
              <p className="font-inter text-sm text-fcb-muted">{text}</p>
            </div>
          </Card>
        ))}
      </div>

      <SectionHeading>{ansprechpartner.heading}</SectionHeading>
      <Card className="max-w-2xl">
        {ansprechpartner.platzhalterHinweis && (
          <div className="mb-4">
            <Banner variant="info" message={ansprechpartner.platzhalterHinweis} />
          </div>
        )}
        {/* Name/Funktion nur, wenn bekannt – bei der JFG steht der Ansprechpartner noch aus. */}
        {ansprechpartner.name && (
          <p className="font-oswald text-lg font-semibold uppercase tracking-wide text-fcb-text">
            {ansprechpartner.name}
          </p>
        )}
        {ansprechpartner.funktion && (
          <p className="mt-1 font-inter text-sm text-fcb-muted">
            {ansprechpartner.funktion}
          </p>
        )}
        <p className="mt-4 font-inter text-sm leading-relaxed text-fcb-text/80">
          {ansprechpartner.text}
        </p>
        <div className="mt-5">
          <ButtonLink href="/kontakt" variant="secondary" size="md">
            Zum Kontakt
          </ButtonLink>
        </div>
      </Card>

      {/* Abschluss-CTA */}
      <div className="mt-14 rounded-2xl border border-fcb-border bg-fcb-surface p-6 text-center sm:p-8">
        <h2 className="font-oswald text-xl font-semibold uppercase tracking-wide text-fcb-text">
          {texte.cta.heading}
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-inter text-sm leading-relaxed text-fcb-text/80">
          {texte.cta.text}
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/mannschaften" variant="primary" size="md">
            Zu den Mannschaften
          </ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary" size="md">
            Kontakt aufnehmen
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
