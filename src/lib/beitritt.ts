/** Alle Angaben gehören ausschließlich zum aktuellen Entwurf auf diesem Gerät. */
export interface Beitrittsdaten {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  geburtsdatum: string;
  telefon: string;
  email: string;
  stammverein: string;
  vertretung: string;
  kontoinhaber: string;
  iban: string;
  bank: string;
  unterschriftsort: string;
}

export type Signaturrolle = "mitglied" | "vertretung" | "kontoinhaber";

export interface Signatur {
  rolle: Signaturrolle;
  name: string;
  zeitpunkt: string;
  ort: string;
  bild: string;
}

export type Beitrittsnachweise = Partial<Record<Signaturrolle, Signatur>>;

export const rollenLabel: Record<Signaturrolle, string> = {
  mitglied: "Mitglied",
  vertretung: "Gesetzliche Vertretung",
  kontoinhaber: "Kontoinhaber/in",
};

export const GLAEUBIGER_ID = "DE69ZZZ00000140832";
export const KONTAKTANSCHRIFT = "Goethestraße 3, 96224 Burgkunstadt";

export function beitrittstext(vereinsname: string): string {
  return `Hiermit beantrage ich die Mitgliedschaft bei der ${vereinsname}. Der Jahresbeitrag beträgt 60 €. Zahlungstermin ist jährlich der 31.01. Die einmalige Eintrittspauschale beträgt 15 €.`;
}

// Gemeinsamer Wortlaut für die Ansicht beim Unterschreiben und das lokale PDF.
export function mandatstext(vereinsname: string): string {
  return `Ich ermächtige den Zahlungsempfänger ${vereinsname}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Zahlungsempfänger ${vereinsname} auf mein Konto gezogenen Lastschriften einzulösen.

Hinweis: Ich kann innerhalb von acht Wochen beginnend mit dem Belastungsdatum die Erstattung des belasteten Betrages verlangen. Mir ist bekannt, dass die ${vereinsname} zur sachgerechten Erfüllung der Vereinszwecke und Aufgabenstellung nach der Satzung, auch nach ergänzenden Verbandsvorgaben, bei erfolgter Aufnahme in den Verein, unter Betrachtung der Datenschutzgrundsätze/Datensicherheit, die mitgeteilten personenbezogenen Daten und Fakten, sowie überlassenes Daten- und Bildmaterial, Dokumente etc. erheben und speichern muss, dies für Vereinszwecke auch verarbeiten, übermitteln und löschen kann.`;
}

export function signaturname(daten: Beitrittsdaten, rolle: Signaturrolle): string {
  if (rolle === "mitglied") return `${daten.vorname.trim()} ${daten.nachname.trim()}`.trim();
  return daten[rolle].trim();
}

export function istMinderjaehrig(isoDatum: string, heute = new Date()): boolean {
  const [jahr, monat, tag] = isoDatum.split("-").map(Number);
  const geburtstag18 = new Date(jahr + 18, monat - 1, tag);
  return heute < geburtstag18;
}

export function normalisiereIban(eingabe: string): string {
  return eingabe.replace(/\s/g, "").replace(/[a-z]/g, (zeichen) => zeichen.toUpperCase());
}

interface IbanPruefung {
  status: "unvollstaendig" | "ungueltig" | "gueltig";
  meldung: string;
  pruefsummenfehler?: boolean;
}

/** Form und Prüfziffer kontrollieren, ohne eine Bank oder einen Dienst anzufragen. */
export function pruefeIban(eingabe: string): IbanPruefung {
  const iban = normalisiereIban(eingabe);
  const deutsch = iban.startsWith("DE");

  if (deutsch) {
    if (/\D/.test(iban.slice(2))) {
      return { status: "ungueltig", meldung: "Nach DE sind nur Ziffern erlaubt." };
    }
    const fehlendeZiffern = 22 - iban.length;
    if (fehlendeZiffern > 0) {
      return {
        status: "unvollstaendig",
        meldung: fehlendeZiffern === 1 ? "Noch 1 Ziffer" : `Noch ${fehlendeZiffern} Ziffern`,
      };
    }
    if (fehlendeZiffern < 0) {
      return { status: "ungueltig", meldung: "Nach DE müssen genau 20 Ziffern stehen." };
    }
  } else {
    if (/[^A-Z]/.test(iban.slice(0, 2))) {
      return { status: "ungueltig", meldung: "Die IBAN muss mit zwei Buchstaben beginnen." };
    }
    if (/\D/.test(iban.slice(2, 4))) {
      return { status: "ungueltig", meldung: "Auf den Ländercode müssen zwei Ziffern folgen." };
    }
    if (/[^A-Z0-9]/.test(iban.slice(4))) {
      return { status: "ungueltig", meldung: "Die IBAN darf nur Buchstaben und Ziffern enthalten." };
    }
    if (iban.length < 15) {
      return { status: "unvollstaendig", meldung: "Die IBAN ist noch unvollständig." };
    }
    if (iban.length > 34) {
      return { status: "ungueltig", meldung: "Die IBAN darf höchstens 34 Zeichen enthalten." };
    }
  }

  const pruefzahl = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (buchstabe) =>
    String(buchstabe.charCodeAt(0) - 55)
  );
  let rest = 0;
  for (const ziffer of pruefzahl) rest = (rest * 10 + Number(ziffer)) % 97;
  return rest === 1
    ? { status: "gueltig", meldung: deutsch ? "IBAN formal gültig" : "IBAN-Prüfsumme stimmt" }
    : {
        status: "ungueltig",
        meldung: "Bitte vergleiche die IBAN noch einmal mit deiner Vorlage.",
        pruefsummenfehler: true,
      };
}

export function ibanFehlermeldung(eingabe: string): string | undefined {
  const pruefung = pruefeIban(eingabe);
  return pruefung.status === "gueltig" ? undefined : pruefung.meldung;
}

export function gueltigeIban(eingabe: string): boolean {
  return pruefeIban(eingabe).status === "gueltig";
}
