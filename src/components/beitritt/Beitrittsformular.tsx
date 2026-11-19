"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { ArrowLeft, ArrowRight, Check, Download } from "lucide-react";
import { useTenant } from "@/components/tenant/TenantProvider";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import {
  beitrittstext,
  GLAEUBIGER_ID,
  gueltigeIban,
  istMinderjaehrig,
  mandatstext,
  rollenLabel,
  signaturname,
  type Beitrittsdaten,
  type Beitrittsnachweise,
  type Signaturrolle,
} from "@/lib/beitritt";
import Unterschriftsfeld from "./Unterschriftsfeld";

type Feld = keyof Beitrittsdaten;
type Fehler = Partial<Record<Feld, string>>;

interface Felddefinition {
  id: Feld;
  label: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  breit?: boolean;
}

const MITGLIEDSDATEN: Felddefinition[] = [
  { id: "vorname", label: "Vorname", maxLength: 80 },
  { id: "nachname", label: "Nachname", maxLength: 80 },
  { id: "strasse", label: "Straße und Hausnummer", maxLength: 140, breit: true },
  { id: "plz", label: "PLZ", inputMode: "numeric", maxLength: 5 },
  { id: "ort", label: "Ort", maxLength: 100 },
  { id: "geburtsdatum", label: "Geburtsdatum", type: "date" },
  { id: "telefon", label: "Telefon", type: "tel", maxLength: 40 },
  { id: "email", label: "E-Mail", type: "email", maxLength: 254, breit: true },
  { id: "stammverein", label: "Stammverein", breit: true },
];

const VERTRETUNG: Felddefinition = {
  id: "vertretung", label: "Vor- und Nachname der gesetzlichen Vertretung", maxLength: 120, breit: true,
};
const UNTERSCHRIFTSORT: Felddefinition = {
  id: "unterschriftsort", label: "Ort für die Unterschriften", maxLength: 100, breit: true,
};
const BANKDATEN: Felddefinition[] = [
  { id: "kontoinhaber", label: "Vor- und Nachname des Kontoinhabers", maxLength: 120, breit: true },
  { id: "iban", label: "IBAN", maxLength: 50 },
  { id: "bank", label: "Name der Bank", maxLength: 100 },
];

const LEERE_DATEN: Beitrittsdaten = {
  vorname: "", nachname: "", strasse: "", plz: "", ort: "", geburtsdatum: "",
  telefon: "", email: "", stammverein: "", vertretung: "", kontoinhaber: "",
  iban: "", bank: "", unterschriftsort: "",
};

const SCHRITTE = ["Daten eingeben", "Unterschreiben", "PDF herunterladen"];
const ALLE_ROLLEN: Signaturrolle[] = ["mitglied", "vertretung", "kontoinhaber"];
const SIGNATUR_TITEL: Record<Signaturrolle, string> = {
  mitglied: "Beitrittserklärung unterschreiben",
  vertretung: "Als gesetzliche Vertretung unterschreiben",
  kontoinhaber: "SEPA-Lastschriftmandat unterschreiben",
};

const MANDAT_FELDER = new Set<Feld>(["vorname", "nachname", "kontoinhaber", "iban", "bank", "unterschriftsort"]);
const BEITRITT_FELDER = new Set<Feld>([...MITGLIEDSDATEN.map(({ id }) => id), "vertretung", "unterschriftsort"]);

function datumGueltig(wert: string, heute = new Date()) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(wert) || wert.startsWith("0000")) return false;
  const datum = new Date(wert + "T00:00:00Z");
  if (Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== wert) return false;

  const heuteISO = [
    String(heute.getFullYear()).padStart(4, "0"),
    String(heute.getMonth() + 1).padStart(2, "0"),
    String(heute.getDate()).padStart(2, "0"),
  ].join("-");
  return wert <= heuteISO;
}

function feldFehler(daten: Beitrittsdaten, felder: Felddefinition[], stammvereine: string[]): Fehler {
  const fehler: Fehler = {};
  for (const { id } of felder) {
    if (!daten[id]) fehler[id] = "Bitte dieses Feld ausfüllen.";
  }
  if (daten.stammverein && !stammvereine.includes(daten.stammverein)) {
    fehler.stammverein = "Bitte einen Stammverein aus der Liste wählen.";
  }
  if (daten.geburtsdatum && !datumGueltig(daten.geburtsdatum)) {
    fehler.geburtsdatum = "Bitte ein gültiges Geburtsdatum bis einschließlich heute eingeben.";
  }
  if (daten.plz && !/^[0-9]{5}$/.test(daten.plz)) fehler.plz = "Bitte eine fünfstellige PLZ eingeben.";
  if (daten.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.email)) {
    fehler.email = "Bitte eine gültige E-Mail-Adresse eingeben.";
  }
  if (daten.iban && !gueltigeIban(daten.iban)) {
    fehler.iban = "Bitte die IBAN prüfen. Sie ist ungültig.";
  }
  return fehler;
}

function formatGeburtsdatum(datum: string) {
  return datum.split("-").reverse().join(".");
}

interface DatenlisteProps {
  daten: Beitrittsdaten;
  felder: Felddefinition[];
}

function Datenliste({ daten, felder }: DatenlisteProps) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {felder.map(({ id, label }) => (
        <div key={id} className="min-w-0">
          <dt className="text-fcb-muted">{label}</dt>
          <dd className="break-words font-medium">
            {id === "geburtsdatum" ? formatGeburtsdatum(daten[id]) : daten[id]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface Entwurf {
  daten: Beitrittsdaten;
  nachweise: Beitrittsnachweise;
}

export default function Beitrittsformular() {
  const tenant = useTenant();
  const stammvereine = tenant.traegervereine.map(({ nameImBeitrittsformular, name }) => nameImBeitrittsformular ?? name);
  const [entwurf, setEntwurf] = useState<Entwurf>({ daten: LEERE_DATEN, nachweise: {} });
  const { daten, nachweise } = entwurf;
  const [unterschreiben, setUnterschreiben] = useState(false);
  const [zeichnung, setZeichnung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<Fehler>({});
  const [neustartOffen, setNeustartOffen] = useState(false);
  const [pdfLaedt, setPdfLaedt] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<"bereit" | "heruntergeladen" | "fehler">("bereit");

  const feldPraefix = useId();
  const abschnitt = useRef<HTMLHeadingElement>(null);
  const hatSchrittGewechselt = useRef(false);
  const minderjaehrig = datumGueltig(daten.geburtsdatum) && istMinderjaehrig(daten.geburtsdatum);
  const mitgliedsdaten = minderjaehrig ? [...MITGLIEDSDATEN, VERTRETUNG] : MITGLIEDSDATEN;
  const rollen = minderjaehrig ? ALLE_ROLLEN : ALLE_ROLLEN.filter((rolle) => rolle !== "vertretung");
  const offeneRolle = rollen.find((rolle) => !nachweise[rolle]);
  const schritt = unterschreiben ? (offeneRolle ? 1 : 2) : 0;
  const titelFokus = unterschreiben ? (offeneRolle ?? "pdf") : "daten";

  useEffect(() => {
    if (hatSchrittGewechselt.current) abschnitt.current?.focus();
  }, [titelFokus]);

  function aendereFeld(feld: Feld, wert: string) {
    setEntwurf((bisher) => {
      if (wert === bisher.daten[feld]) return bisher;

      const neueDaten = { ...bisher.daten, [feld]: wert };
      if (feld === "geburtsdatum" && datumGueltig(wert) && !istMinderjaehrig(wert)) {
        neueDaten.vertretung = "";
      }

      // Sofort entfernen, damit eine spätere Rückänderung die Unterschrift nicht wiederherstellt.
      const neueNachweise = { ...bisher.nachweise };
      if (BEITRITT_FELDER.has(feld)) {
        delete neueNachweise.mitglied;
        delete neueNachweise.vertretung;
      }
      if (MANDAT_FELDER.has(feld)) delete neueNachweise.kontoinhaber;
      return { daten: neueDaten, nachweise: neueNachweise };
    });
    setFehler((bisher) => ({ ...bisher, [feld]: undefined }));
    setPdfStatus("bereit");
  }

  function weiter() {
    const bereinigt = { ...daten };
    for (const id of Object.keys(bereinigt) as Feld[]) bereinigt[id] = bereinigt[id].trim();
    bereinigt.iban = bereinigt.iban.replace(/\s/g, "").toUpperCase();
    if (!minderjaehrig) bereinigt.vertretung = "";
    const felder = [...mitgliedsdaten, ...BANKDATEN, UNTERSCHRIFTSORT];
    const neueFehler = feldFehler(bereinigt, felder, stammvereine);
    setFehler(neueFehler);
    const erstesFehlerfeld = felder.find(({ id }) => neueFehler[id]);
    if (erstesFehlerfeld) {
      requestAnimationFrame(() => document.getElementById(feldPraefix + erstesFehlerfeld.id)?.focus());
      return;
    }
    setEntwurf((bisher) => ({ ...bisher, daten: bereinigt }));
    hatSchrittGewechselt.current = true;
    setUnterschreiben(true);
  }

  function unterschriftUebernehmen() {
    if (!offeneRolle || !zeichnung) return;
    const rolle = offeneRolle;
    const zeitpunkt = new Date().toISOString();
    setEntwurf((bisher) => ({
      ...bisher,
      nachweise: {
        ...bisher.nachweise,
        [rolle]: {
          rolle,
          name: signaturname(bisher.daten, rolle),
          zeitpunkt,
          ort: bisher.daten.unterschriftsort,
          bild: zeichnung,
        },
      },
    }));
    setZeichnung(null);
  }

  function datenBearbeiten() {
    setZeichnung(null);
    setUnterschreiben(false);
  }

  function neuBeginnen() {
    setNeustartOffen(false);
    setEntwurf({ daten: LEERE_DATEN, nachweise: {} });
    setZeichnung(null);
    setFehler({});
    setPdfStatus("bereit");
    setUnterschreiben(false);
    requestAnimationFrame(() => abschnitt.current?.focus());
  }

  async function pdfHerunterladen() {
    if (pdfLaedt || offeneRolle) return;
    setPdfLaedt(true);
    setPdfStatus("bereit");
    try {
      const { beitrittsPdf } = await import("@/lib/beitritts-pdf");
      await beitrittsPdf(daten, nachweise, tenant.name);
      setPdfStatus("heruntergeladen");
    } catch {
      setPdfStatus("fehler");
    } finally {
      setPdfLaedt(false);
    }
  }

  function feld({ id, label, type, inputMode, maxLength, breit }: Felddefinition) {
    const inputId = feldPraefix + id;
    const fehlermeldung = fehler[id];
    const eingabe = {
      id: inputId,
      required: true,
      autoComplete: "off",
      value: daten[id],
      "aria-invalid": fehlermeldung ? true : undefined,
      "aria-describedby": fehlermeldung ? inputId + "-fehler" : undefined,
      className: [
        "min-h-11 w-full min-w-0 rounded-lg border bg-fcb-bg px-3 py-2.5 text-base text-fcb-text",
        "focus:border-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent",
        fehlermeldung ? "border-fcb-red" : "border-fcb-border",
      ].join(" "),
    };
    return (
      <div key={id} className={breit ? "min-w-0 space-y-1.5 sm:col-span-2" : "min-w-0 space-y-1.5"}>
        <label htmlFor={inputId} className="block text-sm font-medium text-fcb-text">{label}</label>
        {id === "stammverein" ? (
          <select
            {...eingabe}
            className={`ui-select ${eingabe.className}`}
            onChange={(event) => aendereFeld(id, event.target.value)}
          >
            <option value="">Bitte wählen</option>
            {stammvereine.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : (
          <input
            {...eingabe}
            type={type ?? "text"}
            inputMode={inputMode}
            maxLength={maxLength}
            spellCheck={false}
            autoCapitalize={id === "iban" ? "characters" : id === "email" ? "none" : undefined}
            onChange={(event) => aendereFeld(id, event.target.value)}
          />
        )}
        {fehlermeldung && <p id={inputId + "-fehler"} className="text-sm text-fcb-text">{fehlermeldung}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 font-inter text-fcb-text">
      <header className="space-y-3">
        <h1 className="break-words font-oswald text-[clamp(1.6rem,8.5vw,2.25rem)] font-bold uppercase tracking-wide sm:text-5xl">
          Beitrittserklärung
        </h1>
        <p className="text-fcb-muted">{tenant.vereinsname}</p>
        <Banner variant="warning" message="Testversion. Bitte nur erfundene Angaben und Test-Unterschriften verwenden." />
        <p className="text-sm text-fcb-muted">
          Du füllst den Antrag im Browser aus und lädst ihn als PDF herunter. Deine Eingaben bleiben in diesem Browser.
        </p>
      </header>
      <noscript><Banner variant="warning" message="Für das Ausfüllen und den PDF-Download muss JavaScript im Browser aktiv sein." /></noscript>

      <ol aria-label="Bearbeitungsschritte" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {SCHRITTE.map((label, index) => (
          <li
            key={label}
            aria-current={schritt === index ? "step" : undefined}
            className={`flex items-center gap-2 ${schritt === index ? "font-semibold" : "text-fcb-muted"}`}
          >
            <span
              aria-hidden
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${schritt === index ? "border-fcb-accent bg-fcb-accent text-white" : "border-fcb-border"}`}
            >
              {index < schritt ? <Check size={14} /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {!unterschreiben ? (
        <Card className="space-y-6">
          {/* Ohne HTML-Formular sind Eingaben auch ohne JavaScript nie Teil eines Requests. */}
          <h2 ref={abschnitt} tabIndex={-1} className="scroll-mt-20 font-oswald text-2xl font-semibold">
            {SCHRITTE[0]}
          </h2>
          <fieldset className="min-w-0">
            <legend className="mb-3 font-oswald text-xl font-semibold">Mitglied</legend>
            <div className="grid gap-4 sm:grid-cols-2">{mitgliedsdaten.map(feld)}</div>
          </fieldset>
          <fieldset className="min-w-0 border-t border-fcb-border pt-3">
            <legend className="pr-3 font-oswald text-xl font-semibold">Bankverbindung</legend>
            <div className="grid gap-4 sm:grid-cols-2">{BANKDATEN.map(feld)}</div>
          </fieldset>
          <div className="border-t border-fcb-border pt-4">{feld(UNTERSCHRIFTSORT)}</div>

          {Object.values(fehler).some(Boolean) && (
            <div role="alert"><Banner variant="error" message="Bitte prüfe die markierten Angaben." /></div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={weiter}>Weiter zu den Unterschriften <ArrowRight size={16} aria-hidden /></Button>
            {Object.values(daten).some(Boolean) && (
              <Button variant="ghost" onClick={() => setNeustartOffen(true)}>Neu beginnen</Button>
            )}
          </div>
        </Card>
      ) : offeneRolle ? (
        <Card className="space-y-6" key={offeneRolle}>
          <div className="space-y-2">
            <p className="text-sm text-fcb-muted">
              Unterschrift {rollen.indexOf(offeneRolle) + 1} von {rollen.length} · {rollenLabel[offeneRolle]}
            </p>
            <h2 ref={abschnitt} tabIndex={-1} className="scroll-mt-20 font-oswald text-2xl font-semibold">
              {SIGNATUR_TITEL[offeneRolle]}
            </h2>
          </div>

          <div className="space-y-4 rounded-lg border border-fcb-border bg-fcb-bg p-4">
            {offeneRolle === "kontoinhaber" ? (
              <>
                <p className="text-sm"><strong>Mitglied</strong> {signaturname(daten, "mitglied")}</p>
                <Datenliste daten={daten} felder={[...BANKDATEN, UNTERSCHRIFTSORT]} />
                <p className="whitespace-pre-line text-sm leading-relaxed">{mandatstext(tenant.name)}</p>
                <dl className="space-y-1 text-sm">
                  <div><dt className="inline font-semibold">Gläubiger-ID </dt><dd className="inline">{GLAEUBIGER_ID}</dd></div>
                  <div><dt className="inline font-semibold">Mandatsreferenz </dt><dd className="inline">Wird vom Verein ergänzt.</dd></div>
                  <div><dt className="inline font-semibold">Zahlungsart </dt><dd className="inline">Wiederkehrende Zahlung</dd></div>
                </dl>
              </>
            ) : (
              <>
                <Datenliste daten={daten} felder={[...mitgliedsdaten, UNTERSCHRIFTSORT]} />
                <p className="whitespace-pre-line text-sm leading-relaxed">{beitrittstext(tenant.name)}</p>
              </>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm">
              <strong>Es unterschreibt {signaturname(daten, offeneRolle)}.</strong>{" "}
              Mit „Unterschrift bestätigen“ unterzeichnest du die oben angezeigte Erklärung. Datum und Uhrzeit werden beim Bestätigen erfasst.
            </p>
            <Unterschriftsfeld
              key={offeneRolle}
              bezeichnung={rollenLabel[offeneRolle]}
              signaturname={signaturname(daten, offeneRolle)}
              onChange={setZeichnung}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={unterschriftUebernehmen} disabled={!zeichnung}>Unterschrift bestätigen</Button>
            <Button onClick={datenBearbeiten} variant="secondary"><ArrowLeft size={16} aria-hidden /> Daten bearbeiten</Button>
          </div>
          <p className="text-sm text-fcb-muted">
            Änderst du Angaben, werden die dazugehörigen Unterschriften verworfen.
          </p>
        </Card>
      ) : (
        <Card className="space-y-6">
          <h2 ref={abschnitt} tabIndex={-1} className="scroll-mt-20 font-oswald text-2xl font-semibold">
            {SCHRITTE[2]}
          </h2>
          <p className="text-sm">Der Antrag ist vollständig. Lade die PDF herunter und bewahre sie bei dir auf.</p>
          <ul className="space-y-2 text-sm" aria-label="Bestätigte Unterschriften">
            {rollen.map((rolle) => {
              const unterschrift = nachweise[rolle];
              if (!unterschrift) return null;
              return (
                <li key={rolle} className="flex items-start gap-2 rounded-lg border border-fcb-border bg-fcb-bg px-3 py-2">
                  <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{rollenLabel[rolle]} · {unterschrift.name}</p>
                    <p className="break-words text-fcb-muted">
                      {unterschrift.ort} · {new Date(unterschrift.zeitpunkt).toLocaleString("de-DE")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {pdfStatus === "heruntergeladen" && (
            <div role="status"><Banner variant="success" message="PDF erstellt. Du findest die Datei bei deinen Downloads." /></div>
          )}
          {pdfStatus === "fehler" && (
            <div role="alert"><Banner variant="error" message="Die PDF konnte nicht erstellt werden. Bitte versuche es erneut." /></div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={pdfHerunterladen} disabled={pdfLaedt}>
              <Download size={16} aria-hidden /> {pdfLaedt ? "PDF wird erstellt …" : "PDF herunterladen"}
            </Button>
            <Button onClick={datenBearbeiten} variant="secondary" disabled={pdfLaedt}>Daten bearbeiten</Button>
            <Button variant="ghost" onClick={() => setNeustartOffen(true)} disabled={pdfLaedt}>Neu beginnen</Button>
          </div>
        </Card>
      )}

      <Modal open={neustartOffen} onClose={() => setNeustartOffen(false)} title="Beitrittserklärung neu beginnen?" size="sm">
        <p className="mb-5 text-sm">
          Der Browser verwirft alle Eingaben und Unterschriften dieses Entwurfs. Bereits heruntergeladene Dateien bleiben auf deinem Gerät.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setNeustartOffen(false)} autoFocus>Weiter bearbeiten</Button>
          <Button variant="danger" onClick={neuBeginnen}>Entwurf verwerfen</Button>
        </div>
      </Modal>
    </div>
  );
}
