"use client";

import { useEffect, useRef, useState } from "react";
import Banner from "@/components/ui/Banner";
import { normalisiereIban, pruefeIban } from "@/lib/beitritt";

interface IbanFeldProps {
  id: string;
  wert: string;
  onChange: (wert: string) => void;
  fehler?: string;
}

function gruppiere(iban: string): string {
  return iban.replace(/.{4}(?=.)/gu, "$& ");
}

export function IbanFeld({ id, wert, onChange, fehler }: IbanFeldProps) {
  const eingabeRef = useRef<HTMLInputElement>(null);
  const trennzeichenLoeschung = useRef<"links" | "rechts" | undefined>(undefined);
  const [komposition, setKomposition] = useState<string | null>(null);
  const [fokussiert, setFokussiert] = useState(false);
  const anzeige = gruppiere(wert);
  const pruefung = pruefeIban(wert);
  const meldungsId = `${id}-meldung`;
  // Ohne landesspezifische Länge kann schon ein Zwischenstand die Prüfung bestehen.
  const wartetAufPruefsumme = fokussiert && !wert.startsWith("DE") &&
    (pruefung.status === "gueltig" || pruefung.pruefsummenfehler);
  const fehlermeldung = fehler ?? (!wartetAufPruefsumme && pruefung.status === "ungueltig" ? pruefung.meldung : undefined);
  const hinweis = wartetAufPruefsumme ? "Bitte gib die IBAN vollständig ein." : pruefung.meldung;

  useEffect(() => {
    const eingabe = eingabeRef.current;
    if (!eingabe) return;

    // Bei einer Auswahl bleiben die nativen Löschregeln erhalten. Ohne Auswahl
    // soll die Löschtaste ein Zeichen der IBAN erreichen, auch an einem Leerzeichen.
    function merkeLoeschrichtung(event: InputEvent) {
      trennzeichenLoeschung.current = undefined;
      const feld = event.currentTarget as HTMLInputElement;
      const cursor = feld.selectionStart;
      if (cursor === null || cursor !== feld.selectionEnd) return;
      if (event.inputType === "deleteContentBackward" && feld.value[cursor - 1] === " ") {
        trennzeichenLoeschung.current = "links";
      }
      if (event.inputType === "deleteContentForward" && feld.value[cursor] === " ") {
        trennzeichenLoeschung.current = "rechts";
      }
    }

    eingabe.addEventListener("beforeinput", merkeLoeschrichtung);
    return () => eingabe.removeEventListener("beforeinput", merkeLoeschrichtung);
  }, []);

  function uebernimmEingabe(eingabe: HTMLInputElement) {
    const rohwert = eingabe.value;
    const cursor = eingabe.selectionStart ?? rohwert.length;
    const vorCursor = rohwert.slice(0, cursor);
    let links = normalisiereIban(vorCursor);
    let rechts = normalisiereIban(rohwert.slice(cursor));
    const richtung = trennzeichenLoeschung.current;
    trennzeichenLoeschung.current = undefined;

    if (links + rechts === wert) {
      if (richtung === "links") links = links.replace(/.$/u, "");
      if (richtung === "rechts") rechts = rechts.replace(/^./u, "");
    }

    const neuerWert = links + rechts;
    const neueAnzeige = gruppiere(neuerWert);
    if (eingabe.value !== neueAnzeige) {
      // React übernimmt denselben Anzeigewert. Die Position basiert auf den
      // Zeichen links vom Cursor und bleibt so beim Umgruppieren erhalten.
      const position = gruppiere(links).length;
      const nachLeerzeichen = neueAnzeige[position] === " " && /\s$/.test(vorCursor);
      const neuePosition = position + Number(nachLeerzeichen);
      eingabe.value = neueAnzeige;
      eingabe.setSelectionRange(neuePosition, neuePosition);
    }
    if (neuerWert !== wert) onChange(neuerWert);
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fcb-text">IBAN</label>
      <input
        id={id}
        name="iban"
        ref={eingabeRef}
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        value={komposition ?? anzeige}
        aria-invalid={fehlermeldung ? true : undefined}
        aria-describedby={meldungsId}
        className={`min-h-11 w-full min-w-0 scroll-mt-20 rounded-lg border bg-fcb-bg px-3 py-2.5 text-base text-fcb-text
          focus:border-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent
          ${fehlermeldung ? "border-fcb-red" : "border-fcb-border"}`}
        onFocus={() => setFokussiert(true)}
        onBlur={() => setFokussiert(false)}
        onCompositionStart={() => setKomposition(anzeige)}
        onCompositionEnd={(event) => {
          setKomposition(null);
          uebernimmEingabe(event.currentTarget);
        }}
        onChange={(event) => {
          if (komposition !== null) setKomposition(event.currentTarget.value);
          else uebernimmEingabe(event.currentTarget);
        }}
      />
      <div id={meldungsId} role="status" aria-atomic="true">
        {fehlermeldung ? (
          <Banner variant="error" message={fehlermeldung} />
        ) : !wartetAufPruefsumme && pruefung.status === "gueltig" ? (
          <Banner variant="success" message={pruefung.meldung} />
        ) : (
          <p className="text-sm text-fcb-muted">
            {wert ? hinweis : "Bei einer deutschen IBAN folgen auf DE genau 20 Ziffern."}
          </p>
        )}
      </div>
    </div>
  );
}
