// Zentrale Anlaufstelle aller Passwort-Regeln: lokale Stärke und Prüfung auf bekannte Datenlecks.

export type PasswortLeakErgebnis =
  | { status: "geleakt"; anzahl: number }
  | { status: "sicher" }
  | { status: "unbekannt"; fehler: string };

export const PASSWORT_GELEAKT_MELDUNG = "Dieses Passwort ist in bekannten Datenlecks aufgetaucht und daher unsicher. Bitte wähle ein anderes.";

export async function pruefePasswortLeak(
  passwort: string,
  optionen?: { fetchImpl?: typeof fetch; timeoutMs?: number; endpunkt?: string },
): Promise<PasswortLeakErgebnis> {
  // Pflichtfeld und Stärke werden lokal geprüft; leere Eingaben brauchen keine Anfrage.
  if (!passwort) return { status: "sicher" };

  try {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Die kryptografische Passwort-Prüfung ist nicht verfügbar.");
    }

    // SHA-1 dient nur dem HIBP-Abgleich, nicht der Passwortspeicherung.
    // Durch k-Anonymity verlassen weder Passwort noch voller Hash oder Suffix den Client.
    const hashBytes = await globalThis.crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(passwort),
    );
    const hash = Array.from(new Uint8Array(hashBytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const fetchImpl = optionen?.fetchImpl ?? globalThis.fetch;
    const endpunkt = optionen?.endpunkt ?? "/api/passwort-leak-check";
    const antwort = await fetchImpl(`${endpunkt}?prefix=${prefix}`, {
      signal: AbortSignal.timeout(optionen?.timeoutMs ?? 3000),
      cache: "no-store",
    });

    if (!antwort.ok) {
      throw new Error("Der Passwort-Leak-Dienst ist nicht erreichbar.");
    }

    for (const zeile of (await antwort.text()).split(/\r?\n/)) {
      const treffer = /^([0-9a-f]{35}):(\d+)$/i.exec(zeile);
      if (!treffer || treffer[1].toUpperCase() !== suffix) continue;

      const anzahl = Number(treffer[2]);
      // HIBP ergänzt zur Verschleierung der Antwortgröße Padding mit Anzahl 0.
      if (Number.isSafeInteger(anzahl) && anzahl > 0) {
        return { status: "geleakt", anzahl };
      }
    }

    return { status: "sicher" };
  } catch {
    // Fail-open: Ein Dienstausfall darf die vorgelagerten lokalen Regeln nicht blockieren.
    // Eine feste Meldung verhindert, dass fremde Fehlerdetails Passwortdaten offenlegen.
    const fehler = "Die Passwort-Leak-Prüfung ist derzeit nicht verfügbar.";
    console.warn(fehler);
    return { status: "unbekannt", fehler };
  }
}

export interface PasswortFeedback {
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasMinLength: boolean;
}

export function berechnePasswortFeedback(passwort: string): PasswortFeedback {
  return {
    hasLower: /[a-z]/.test(passwort),
    hasUpper: /[A-Z]/.test(passwort),
    hasNumber: /[0-9]/.test(passwort),
    hasSymbol: /[^A-Za-z0-9]/.test(passwort),
    hasMinLength: passwort.length >= 8,
  };
}

export function berechnePasswortStaerke(feedback: PasswortFeedback): number {
  return (
    Number(feedback.hasLower) +
    Number(feedback.hasUpper) +
    Number(feedback.hasNumber) +
    Number(feedback.hasSymbol) +
    Number(feedback.hasMinLength)
  );
}

export function passwortStaerkeLabel(score: number): string {
  if (score <= 2) return "Sehr schwach";
  if (score === 3) return "Mittel";
  if (score === 4) return "Gut";
  return "Sehr stark";
}

export function passwortStaerkefarbe(score: number): string {
  if (score <= 2) return "bg-red-500 w-1/5";
  if (score === 3) return "bg-yellow-400 w-3/5";
  if (score === 4) return "bg-yellow-500 w-4/5";
  return "bg-green-500 w-full";
}
