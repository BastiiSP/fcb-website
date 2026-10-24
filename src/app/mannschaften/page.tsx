import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import TeamCard from "@/components/ui/TeamCard";
import ButtonLink from "@/components/ui/ButtonLink";
import SpielbetriebSection from "@/components/spielbetrieb/SpielbetriebSection";
import { getTeamsFuerTraeger, type Team } from "@/lib/teams";
import type { TenantId } from "@/lib/tenant";
import { getTenantConfigServer } from "@/lib/tenant.server";

// Öffentliche Mannschaftsübersicht – kein Auth-Check, Server Component.
// Die TeamCards (Client, Framer Motion) kommen fertig aus dem Design-System.
//
// Multi-Tenant: Jeder Auftritt zeigt AUSSCHLIESSLICH die Mannschaften seines
// eigenen Trägers. Der FCB zeigte die JFG-Jahrgänge früher zusätzlich mit an
// (als Erklärung der Kooperation) – seit die JFG eine eigene Domain hat,
// gehören diese Infos ausschließlich dorthin (2026-07-29, auf Bastis
// Wunsch entfernt).

/** Markenabhängige Fließtexte der Seite. */
interface SeitenTexte {
  metaDescription: string;
  subtitle: string;
  intro: string;
  ctaTitel: string;
  ctaText: string;
}

const TEXTE: Record<TenantId, SeitenTexte> = {
  // FCB: JFG-Erwähnung entfernt (2026-07-29) – die JFG hat jetzt ihre eigene
  // Domain, entsprechende Infos gehören dort hin, nicht mehr auf fcbuku.de.
  fcb: {
    metaDescription:
      "Alle Mannschaften des 1. FC 1911 Burgkunstadt: von den Bambini bis zur Ersten.",
    subtitle: "Von den Bambini bis zur Ersten: Hier spielt ganz Burgkunstadt.",
    intro:
      "Beim FCB kann jeder kicken: die Kleinsten fangen bei den Bambini an und die Herren spielen sonntags um Punkte.",
    ctaTitel: "Du willst mitspielen?",
    ctaText:
      "Komm einfach zum Training vorbei oder meld dich kurz. Wir sagen dir, wann deine Altersklasse auf dem Platz steht.",
  },
  jfg: {
    metaDescription:
      "Die Mannschaften der JFG Kunstadt-Obermain: A- bis D-Junioren, leistungsorientiert gefördert von drei Trägervereinen.",
    subtitle: "A- bis D-Junioren: leistungsorientierter Nachwuchsfußball.",
    intro:
      "In der JFG Kunstadt-Obermain bündeln der 1. FC 1911 Burgkunstadt, die SG Roth-Main Mainroth und der 1. FC 1916 Redwitz a. d. Rodach ihre älteren Jugendjahrgänge. Die Teams werden leistungsgerecht eingeteilt, damit jeder Spieler genau dort gefördert wird, wo er steht.",
    ctaTitel: "Du willst bei uns spielen?",
    ctaText:
      "Melde dich kurz bei uns – wir sagen dir, wann dein Jahrgang trainiert, und laden dich zum Probetraining ein.",
  },
};

/** Team-Grid im Muster der Design-Spec (mobile-first, ab sm im Raster). */
function TeamGrid({ teams, className = "" }: { teams: Team[]; className?: string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}>
      {teams.map((team) => (
        <TeamCard key={team.id} team={team} />
      ))}
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  return {
    title: "Mannschaften",
    alternates: { canonical: "/mannschaften" },
    description: TEXTE[tenant.id].metaDescription,
  };
}

export default async function MannschaftenPage() {
  const tenant = await getTenantConfigServer();
  const texte = TEXTE[tenant.id];
  const eigeneTeams = getTeamsFuerTraeger(tenant.traeger);

  return (
    <PageShell maxWidth="2xl">
      <PageHeader title="Unsere Mannschaften" subtitle={texte.subtitle} />

      <p className="max-w-2xl font-inter text-base leading-relaxed text-fcb-text/80">
        {texte.intro}
      </p>

      {/* Jede Marke zeigt ausschließlich ihre eigenen Teams – keine
          Träger-Zwischenüberschrift nötig, da der ganze Auftritt schon die
          jeweilige Marke ist. */}
      <TeamGrid teams={eigeneTeams} className="mt-8" />

      {/* Tabelle & Spiele: Die Sektion lädt nur Teams des aktuellen Trägers;
          Mehrfachmeldungen einer Altersklasse werden dort separat auswählbar. */}
      <SpielbetriebSection />

      {/* Abschluss-CTA – bewusst nur ein primary auf der Seite */}
      <div className="mt-14 rounded-2xl border border-fcb-border bg-fcb-surface p-6 text-center sm:p-8">
        <h2 className="font-oswald text-xl font-semibold uppercase tracking-wide text-fcb-text">
          {texte.ctaTitel}
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-inter text-sm leading-relaxed text-fcb-text/80">
          {texte.ctaText}
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/kontakt" variant="primary" size="md">
            Kontakt aufnehmen
          </ButtonLink>
          <ButtonLink href="/verein" variant="secondary" size="md">
            Mehr über den Verein
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
