import type { User } from "@supabase/supabase-js";

/**
 * Auswertung der Links aus den Supabase-Systemmails (Bestätigung, E-Mail-Änderung,
 * Passwort-Reset).
 *
 * Die Vorlagen unter supabase/templates/ verlinken bewusst direkt auf unsere Seite
 * mit `token_hash` statt auf den Supabase-Verify-Endpunkt: Mail-Scanner (z. B.
 * Safe Links) rufen Links vorab auf und würden einen GET-Verify-Link verbrauchen.
 * Eingelöst wird erst per `verifyOtp` nach einem Klick auf der Seite.
 *
 * Reine Funktionen ohne Browser-Zugriff, damit sie sich ohne Seite testen lassen.
 */

export type MailLinkTyp = "signup" | "email_change" | "recovery";

export interface MailLinkParameter {
  tokenHash: string;
  typ: MailLinkTyp;
}

const MAIL_LINK_TYPEN: readonly MailLinkTyp[] = ["signup", "email_change", "recovery"];

function istMailLinkTyp(wert: string | null): wert is MailLinkTyp {
  return wert !== null && (MAIL_LINK_TYPEN as readonly string[]).includes(wert);
}

/** Liest `token_hash` und `type` aus dem Query-String; null bei fehlenden/unbekannten Werten. */
export function leseMailLinkParameter(search: string): MailLinkParameter | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get("token_hash");
  const typ = params.get("type");
  if (!tokenHash || !istMailLinkTyp(typ)) return null;
  return { tokenHash, typ };
}

/**
 * Zielseite für einen Mail-Link, der auf der Startseite gelandet ist.
 *
 * Steht die übergebene Rücksprung-URL nicht auf der Supabase-Allowlist, setzt
 * Supabase `{{ .RedirectTo }}` auf die Site URL – der Link endet dann ohne Pfad
 * auf `/?token_hash=…`. Der Proxy leitet solche Aufrufe auf die passende Seite
 * weiter, statt den Token auf der Startseite verfallen zu lassen.
 */
export function mailLinkZielseite(pfad: string, search: string): string | null {
  if (pfad !== "/") return null;
  const parameter = leseMailLinkParameter(search);
  if (!parameter) return null;
  return parameter.typ === "recovery" ? "/passwort-neu" : "/confirm-email";
}

/**
 * True, wenn Supabase einen Fehler zurück in die URL geschrieben hat. Das passiert
 * bei Links im alten Format (Verify-Endpunkt mit `redirect_to`), wenn der Link
 * abgelaufen oder schon verbraucht ist – je nach Version im Hash oder im Query-String.
 */
export function hatMailLinkFehler(search: string, hash: string): boolean {
  const ausHash = new URLSearchParams(hash.replace(/^#/, ""));
  const ausQuery = new URLSearchParams(search);
  return [ausHash, ausQuery].some((p) => p.has("error") || p.has("error_code"));
}

/**
 * Passwortkonto = Konto mit E-Mail-Identität. Reine Google-Konten haben keine und
 * sollen über den Reset-Flow kein Website-Passwort bekommen (Entscheidung vom
 * 24.10.2026). Die eigentliche Sperre liegt in der Reset-Vorlage (Link nur mit
 * Marker `passwort_login`); diese Prüfung ist die zweite Ebene auf der Seite.
 */
export function istPasswortkonto(user: Pick<User, "identities"> | null | undefined): boolean {
  return Boolean(user?.identities?.some((identitaet) => identitaet.provider === "email"));
}
