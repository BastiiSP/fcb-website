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

/** Form und Prüfziffer kontrollieren, ohne eine Bank oder einen Dienst anzufragen. */
export function gueltigeIban(eingabe: string): boolean {
  const iban = eingabe.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && !/^DE\d{20}$/.test(iban)) return false;
  const pruefzahl = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (buchstabe) =>
    String(buchstabe.charCodeAt(0) - 55)
  );
  let rest = 0;
  for (const ziffer of pruefzahl) rest = (rest * 10 + Number(ziffer)) % 97;
  return rest === 1;
}
