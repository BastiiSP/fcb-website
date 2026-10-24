/**
 * Behold liefert kein Alt-Text-Feld (am 24.10.2026 geprüft). Caption und
 * Überschrift beschreiben den Bildinhalt nicht zuverlässig.
 */
export function instagramBildAlt(timestamp: string, nummer?: number, anzahl?: number): string {
  const datum = new Date(timestamp);
  if (Number.isNaN(datum.getTime())) return "Bild aus einem Instagram-Beitrag";
  const formatiert = new Intl.DateTimeFormat("de-DE", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin",
  }).format(datum);
  const prefix = anzahl !== undefined && anzahl > 1 && nummer !== undefined
    ? `Bild ${nummer} von ${anzahl}`
    : "Bild";
  return `${prefix} aus dem Instagram-Beitrag vom ${formatiert}`;
}
