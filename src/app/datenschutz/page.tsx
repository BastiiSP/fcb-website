import type { Metadata } from "next";
import {
  RechtstextLayout,
  RechtstextSektion,
} from "@/components/rechtstexte/RechtstextLayout";
import { getTenantConfigServer } from "@/lib/tenant.server";
import { RECHTSTEXTE } from "@/lib/rechtstexte";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  return {
    title: `Datenschutzerklärung – ${tenant.name}`,
    description: `Informationen zur Verarbeitung personenbezogener Daten in der Vereins-WebApp des ${tenant.vereinsname}.`,
  };
}

export default async function DatenschutzPage() {
  const tenant = await getTenantConfigServer();
  const angaben = RECHTSTEXTE[tenant.id];

  return (
    <RechtstextLayout titel="Datenschutzerklärung" stand="September 2026">
      <p className="font-inter leading-relaxed text-fcb-text/80">
        Der Schutz deiner persönlichen Daten ist uns wichtig. Nachfolgend
        erklären wir, welche Daten beim Besuch und bei der Nutzung dieser
        Vereins-WebApp verarbeitet werden, zu welchem Zweck und auf welcher
        Rechtsgrundlage.
      </p>

      <RechtstextSektion titel="Verantwortlicher">
        <p>
          {angaben.vollerName}
          <br />
          {angaben.vertreterName} ({angaben.vertreterFunktion})
          <br />
          {angaben.strasse}
          <br />
          {angaben.ort}
          <br />
          <a
            href={`mailto:${angaben.email}`}
            className="text-fcb-accent hover:underline"
          >
            {angaben.email}
          </a>
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Hosting und Zugriffsdaten">
        <p>
          Diese WebApp wird bei der Vercel Inc. (USA) gehostet, die für uns als
          Auftragsverarbeiter tätig ist. Bei jedem Aufruf werden automatisch
          technische Zugriffsdaten verarbeitet – etwa IP-Adresse, Browsertyp,
          Betriebssystem sowie Datum und Uhrzeit des Zugriffs. Diese Daten dienen
          dem sicheren Betrieb, der Auslieferung der Seite und der Fehleranalyse.
        </p>
        <p>
          Die Verarbeitung erfolgt auf Grundlage unseres berechtigten Interesses
          an einem stabilen und sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
          Eine Übermittlung in die USA wird durch entsprechende vertragliche
          Garantien (EU-Standardvertragsklauseln) abgesichert.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Reichweiten- und Performance-Messung (Vercel Analytics & Speed Insights)">
        <p>
          Auf allen Seiten dieser WebApp setzen wir Vercel Analytics und Vercel
          Speed Insights ein, um zu erfassen, wie die Seite genutzt wird und wie
          schnell sie lädt (z. B. aufgerufene Seiten, grobe Herkunft der Zugriffe,
          Core-Web-Vitals-Messwerte wie Ladezeit und Interaktionsverzögerung).
          Dies ist eine eigenständige Verarbeitung durch Vercel, die über die
          reinen Hosting-Zugriffsdaten hinausgeht.
        </p>
        <p>
          Beide Dienste sind bewusst datensparsam ausgelegt: Es werden keine
          Cookies gesetzt und keine dauerhaften Kennungen gespeichert, mit denen
          du über mehrere Besuche hinweg wiedererkannt werden könntest. Die
          erhobenen Nutzungs- und Performance-Daten werden aggregiert und dienen
          ausschließlich der Analyse und Verbesserung der Website – ein
          individuelles Nutzerprofil wird nicht gebildet.
        </p>
        <p>
          Die Verarbeitung erfolgt auf Grundlage unseres berechtigten Interesses
          an der Optimierung und Fehlerfreiheit unserer WebApp (Art. 6 Abs. 1
          lit. f DSGVO). Da keine Cookies zum Einsatz kommen, ist hierfür keine
          gesonderte Einwilligung nach § 25 TDDDG erforderlich.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Datenbank und Nutzerkonten (Supabase)">
        <p>
          Für Nutzerkonten, Anmeldung, Platzbuchungen und die Mitgliederverwaltung
          nutzen wir den Datenbank- und Authentifizierungsdienst Supabase
          (Supabase Inc.). Supabase handelt dabei als Auftragsverarbeiter im Sinne
          des Art. 28 DSGVO und verarbeitet die Daten ausschließlich nach unseren
          Weisungen. Ein entsprechender Auftragsverarbeitungsvertrag (AVV / Data
          Processing Addendum) wurde im Juni 2026 abgeschlossen.
        </p>
        <p>
          Für dein Nutzerkonto verarbeiten wir je nach Funktion: Vorname,
          Nachname, E-Mail-Adresse, Telefonnummer, Geburtsdatum, Anschrift
          (Straße, PLZ, Ort), Vereinsrolle, Mannschaftszugehörigkeit,
          Trainerlizenzen sowie dein optionales Profilbild. Stellst du über dein
          Profil eine Anfrage zum Wechsel der Mannschaft (Beitritt oder Austritt),
          speichern wir zusätzlich die betroffene Mannschaft, den Anfragetyp,
          eine optionale Begründung sowie den Bearbeitungsstatus dieser Anfrage.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Anmeldung mit Google (OAuth)">
        <p>
          Alternativ zur klassischen Registrierung kannst du dich mit deinem
          Google-Konto anmelden. Dabei fragt Supabase über den Anmeldedialog von
          Google (Google Ireland Limited bzw. Google LLC) deinen Namen und deine
          E-Mail-Adresse ab, um daraus dein Nutzerkonto anzulegen; weitere
          Berechtigungen (z. B. für Werbung oder sonstige Google-Dienste) werden
          nicht angefragt. Google verarbeitet dabei als eigenständig
          Verantwortlicher Daten nach seinen eigenen Datenschutzbestimmungen; die
          Anmeldung selbst bestätigst du im Consent-Bildschirm von Google.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
          Nutzungsverhältnisses durch Anlage deines Kontos) in Verbindung mit
          deiner im Google-Anmeldedialog erteilten Einwilligung (Art. 6 Abs. 1
          lit. a DSGVO).
        </p>
      </RechtstextSektion>

      {/* Bewusst ohne Tenant-Bedingung: Registrierung und Passwort-Ändern gibt
          es auf beiden Auftritten (FCB + JFG). Technik: /api/passwort-leak-check. */}
      <RechtstextSektion titel="Prüfung auf unsichere Passwörter (Pwned Passwords)">
        <p>
          Wenn du dich registrierst oder dein Passwort änderst, prüfen wir, ob
          das gewählte Passwort bereits in bekannten Datenlecks aufgetaucht ist.
          Dazu nutzen wir den kostenlosen Dienst „Pwned Passwords“ von Have I
          Been Pwned (Betreiber: Troy Hunt, Australien; ausgeliefert über
          Cloudflare).
        </p>
        <p>
          Dein Passwort verlässt dabei <strong>weder im Klartext noch als
          vollständiger Hashwert</strong> deinen Browser: Dein Browser berechnet
          einen SHA-1-Hashwert und übermittelt nur dessen erste fünf Zeichen an
          unseren Server. Unser Server fragt damit eine Liste von mehreren hundert
          möglichen Treffern ab; der eigentliche Abgleich findet ausschließlich
          in deinem Browser statt (sogenanntes k-Anonymity-Verfahren). Die Anfrage
          an Have I Been Pwned stellt unser Server, daher wird{" "}
          <strong>keine IP-Adresse und keine sonstigen personenbezogenen Daten
          deines Browsers</strong> an den Dienst übermittelt. Weder wir noch Have
          I Been Pwned speichern das Ergebnis der Prüfung.
        </p>
        <p>
          Ist der Dienst nicht erreichbar, entfällt die Prüfung und die
          Registrierung bzw. Passwortänderung funktioniert trotzdem.
          Rechtsgrundlage ist unser berechtigtes Interesse an der Sicherheit der
          Nutzerkonten (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Profilbild (Avatar-Upload)">
        <p>
          Lädst du in deinem Profil ein Profilbild hoch, speichern wir es in
          einem Supabase-Storage-Bucket. Aus technischen Gründen ist die
          Bild-URL öffentlich abrufbar (nicht durch einen Login geschützt) – sie
          enthält jedoch eine nicht erratbare, zufällige Kennung und wird nicht
          von Suchmaschinen indexiert oder an anderer Stelle verlinkt. Das
          Hochladen ist freiwillig; die Verarbeitung erfolgt auf Grundlage deiner
          Einwilligung durch den aktiven Upload (Art. 6 Abs. 1 lit. a DSGVO). Du
          kannst dein Profilbild jederzeit über dein Profil ersetzen oder den
          Vorstand um Löschung bitten.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Mitgliederverwaltung (Vereinsmitglieder ohne eigenes Nutzerkonto)">
        <p>
          Für Vereinsmitglieder, die keinen eigenen Account in dieser WebApp
          nutzen, pflegt der Vorstand Mitgliedsdaten in einer separaten
          Verwaltungsansicht: Vorname, Nachname, E-Mail-Adresse und
          Telefonnummer (jeweils optional), Geburtsdatum, Eintrittsdatum,
          Mitgliedsstatus (aktiv/passiv/Ehrenamt/gekündigt), Mannschaftszugehörigkeit
          sowie interne Notizen. Zugriff auf diese Daten haben ausschließlich
          Vorstand und Admin.
        </p>
        <p>
          Rechtsgrundlage ist die Erfüllung des Mitgliedschaftsverhältnisses nach
          der Vereinssatzung (Art. 6 Abs. 1 lit. b DSGVO) sowie unser berechtigtes
          Interesse an einer funktionierenden Vereins- und Mannschaftsorganisation
          (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </RechtstextSektion>

      {/* Sportheim-Anfrage ist FCB-Anlagenverwaltung, existiert auf der
          JFG-Domain nicht (404, siehe /sportheim) – Sektion entsprechend nur
          dort zeigen, wo die Funktion tatsächlich erreichbar ist. */}
      {tenant.id === "fcb" && (
        <RechtstextSektion titel="Sportheim-Anfrage (öffentliches Formular)">
          <p>
            Über unsere Sportheim-Seite kann jede Person – auch ohne Nutzerkonto
            und ohne Login – unverbindlich eine Nutzung des Sportheims anfragen.
            Dabei verarbeiten wir Vorname, Nachname, E-Mail-Adresse, Telefonnummer,
            den gewünschten Zeitraum, den Anlass sowie eine optionale Nachricht.
            Die Anfrage wird dem Vorstand zur Prüfung vorgelegt; eine automatische
            Bestätigungs-E-Mail wird nicht versendet.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche
            Maßnahme zur Anbahnung einer Sportheim-Nutzung auf deine Anfrage hin).
          </p>
        </RechtstextSektion>
      )}

      <RechtstextSektion titel="Zweck der Datenverarbeitung">
        <p>
          Die Datenverarbeitung dient der Organisation des Vereins- und
          Spielbetriebs: Verwaltung von Nutzerkonten und Rollen, Buchung und
          Belegung der Plätze, der Mitgliederverwaltung sowie der Bearbeitung von
          Sportheim-Anfragen.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Rechtsgrundlage">
        <p>
          Die Verarbeitung erfolgt je nach Funktion auf Grundlage von Art. 6
          Abs. 1 lit. b DSGVO (Erfüllung des Mitgliedschafts- bzw.
          Nutzungsverhältnisses, vorvertragliche Maßnahmen wie die
          Sportheim-Anfrage), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
          am Vereinsbetrieb, an der IT-Sicherheit und an der
          Website-Optimierung) sowie – wo eine Einwilligung erforderlich ist
          (siehe „Cookies und Einwilligung“, „Anmeldung mit Google“ und
          „Profilbild“) – Art. 6 Abs. 1 lit. a DSGVO.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Cookies und Einwilligung">
        <p>
          Wir verwenden Cookies und vergleichbare Speichertechnologien (z. B.
          lokalen Browser-Speicher) in zwei Kategorien:
        </p>
        <p>
          <strong>Technisch notwendig:</strong> Diese sind für den Betrieb
          erforderlich – etwa zur Verwaltung deiner Anmelde-Sitzung (Login) und
          zum Speichern deiner Cookie-Entscheidung. Sie sind immer aktiv; eine
          Einwilligung ist hierfür nicht erforderlich (§ 25 Abs. 2 TDDDG, Art. 6
          Abs. 1 lit. f DSGVO).
        </p>
        <p>
          <strong>Externe Inhalte (optional):</strong> Einbettungen von
          Drittanbietern werden erst geladen, nachdem du dem zugestimmt hast. Bis
          zur Zustimmung erscheint an ihrer Stelle ein Platzhalter.
        </p>
        <p>
          Beim ersten Besuch erscheint ein Cookie-Banner, über den du diese
          Auswahl triffst. Deine Entscheidung wird dauerhaft in deinem Browser
          (lokaler Speicher) abgelegt, nicht an Dritte übermittelt und nicht für
          Tracking verwendet. Du kannst sie jederzeit über den Button
          „Cookie-Einstellungen“ im Footer erneut öffnen und ändern.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Instagram-Feed (Behold.so)">
        <p>
          Auf der Startseite zeigen wir aktuelle Instagram-Beiträge des Vereins.
          Die Beiträge werden über den Dienst Behold.so bereitgestellt. Den Feed
          rufen wir serverseitig ab; auch die angezeigten Bilder werden über
          unseren Server bzw. den Bild-Dienst unseres Hosters (Vercel)
          ausgeliefert.
        </p>
        <p>
          Dabei wird <strong>keine IP-Adresse und keine sonstigen
          personenbezogenen Daten deines Browsers an Behold.so übermittelt</strong>,
          und es werden hierfür keine Cookies gesetzt. Erst wenn du einen Beitrag
          anklickst, öffnet sich die Website instagram.com in einem neuen Tab –
          dann gelten die Datenschutzhinweise von Instagram bzw. Meta.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Externe Links">
        <p>
          Unsere Seiten enthalten Links zu externen Diensten (z. B. Instagram,
          Facebook). Sobald du einem solchen Link folgst, werden deine Daten von
          dem jeweiligen Anbieter nach dessen eigenen Datenschutzbestimmungen
          verarbeitet. Hierauf haben wir keinen Einfluss.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es für die
          genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen
          es vorschreiben. Nutzerkonto- und Mitgliederdaten werden auf Wunsch oder
          nach Wegfall des Zwecks gelöscht. Sportheim-Anfragen werden gelöscht,
          sobald sie abschließend bearbeitet sind und keine Aufbewahrungspflicht
          entgegensteht.
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung
          der Verarbeitung deiner Daten sowie das Recht auf Datenübertragbarkeit.
          Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die
          Zukunft widerrufen. Wende dich dazu bitte an{" "}
          <a
            href={`mailto:${angaben.email}`}
            className="text-fcb-accent hover:underline"
          >
            {angaben.email}
          </a>
          .
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Beschwerderecht">
        <p>
          Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
          beschweren. Für uns zuständig ist das Bayerische Landesamt für
          Datenschutzaufsicht (BayLDA).
        </p>
      </RechtstextSektion>

      <RechtstextSektion titel="Änderungen dieser Datenschutzerklärung">
        <p>
          Wir passen diese Datenschutzerklärung an, sobald Änderungen der WebApp
          oder der rechtlichen Rahmenbedingungen dies erfordern. Es gilt jeweils
          die hier veröffentlichte aktuelle Fassung.
        </p>
      </RechtstextSektion>
    </RechtstextLayout>
  );
}
