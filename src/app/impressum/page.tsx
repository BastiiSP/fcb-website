import type { Metadata } from "next";
import {
  RechtstextLayout,
  RechtstextSektion,
} from "@/components/rechtstexte/RechtstextLayout";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { RECHTSTEXTE } from "@/lib/rechtstexte";

// Titel/Beschreibung nennen den Verein namentlich – deshalb markenabhängig
// über generateMetadata() statt statischem metadata-Export (Muster wie
// /verein und /kontakt).
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  return {
    title: "Impressum",
    alternates: { canonical: "/impressum" },
    description: `Impressum und Anbieterkennzeichnung ${tenant.vereinsnameGenitiv}.`,
  };
}

export default async function ImpressumPage() {
  const angaben = RECHTSTEXTE[(await getTenantConfigServer()).id];

  return (
    <RechtstextLayout titel="Impressum" stand="Juli 2026">
      {/* Anbieterkennzeichnung: § 5 TMG wurde am 14.05.2024 durch § 5 DDG
          (Digitale-Dienste-Gesetz) abgelöst. */}
      <RechtstextSektion titel="Angaben gemäß § 5 DDG">
        <p>
          {angaben.vollerName}
          {angaben.bekanntAls && ` (bekannt als ${angaben.bekanntAls})`}
          <br />
          {angaben.strasse}
          <br />
          {angaben.ort}
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Vertreten durch">
        <p>
          {angaben.vertreterFunktion}: {angaben.vertreterName}
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Eintragung im Vereinsregister">
        <p>
          Eingetragen im Vereinsregister beim {angaben.registergericht} unter
          der Nummer {angaben.registerNummer}.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Kontakt">
        <p>
          {angaben.telefon && (
            <>
              Telefon:{" "}
              {angaben.telefonHref ? (
                <a href={angaben.telefonHref} className="hover:underline">
                  {angaben.telefon}
                </a>
              ) : (
                angaben.telefon
              )}
              <br />
            </>
          )}
          E-Mail:{" "}
          <a
            href={`mailto:${angaben.email}`}
            className="text-fcb-accent hover:underline"
          >
            {angaben.email}
          </a>
        </p>
      </RechtstextSektion>

      {/* § 55 Abs. 2 RStV ist seit Nov. 2020 außer Kraft – korrekt: § 18 Abs. 2 MStV. */}
      <RechtstextSektion titel="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>
          {angaben.vertreterName}
          <br />
          {angaben.strasse}
          <br />
          {angaben.ort}
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Haftungsausschluss">
        <p>
          Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt
          erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der
          Inhalte können wir jedoch keine Gewähr übernehmen.
        </p>
        <p>
          Unsere Seiten enthalten Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten
          Seiten ist stets der jeweilige Anbieter verantwortlich.
        </p>
      </RechtstextSektion>
    </RechtstextLayout>
  );
}
