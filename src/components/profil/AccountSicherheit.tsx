"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  berechnePasswortFeedback,
  berechnePasswortStaerke,
  passwortStaerkeLabel,
  passwortStaerkefarbe,
  pruefePasswortLeak,
  PASSWORT_GELEAKT_MELDUNG,
  type PasswortFeedback,
} from "@/utils/passwortStaerke";
import TextField from "@/components/ui/TextField";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";

interface AccountSicherheitProps {
  aktuelleEmail: string;
}

export default function AccountSicherheit({ aktuelleEmail }: AccountSicherheitProps) {
  const supabase = createClient();

  // E-Mail ändern
  const [neueEmail, setNeueEmail] = useState("");
  const [emailPasswort, setEmailPasswort] = useState("");
  const [emailLaden, setEmailLaden] = useState(false);
  const [emailFehler, setEmailFehler] = useState("");
  const [emailErfolg, setEmailErfolg] = useState("");

  // Passwort ändern
  const [aktuellesPasswort, setAktuellesPasswort] = useState("");
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [passwortBestaetigung, setPasswortBestaetigung] = useState("");
  const [passwortAnzeigen, setPasswortAnzeigen] = useState(false);
  const [passwortLaden, setPasswortLaden] = useState(false);
  const [passwortFehler, setPasswortFehler] = useState("");
  const [passwortErfolg, setPasswortErfolg] = useState("");

  const [passwortFeedback, setPasswortFeedback] = useState<PasswortFeedback>({
    hasLower: false,
    hasUpper: false,
    hasNumber: false,
    hasSymbol: false,
    hasMinLength: false,
  });
  const [passwortStaerke, setPasswortStaerke] = useState(0);

  const handleNeuesPasswortChange = (value: string) => {
    setNeuesPasswort(value);
    const feedback = berechnePasswortFeedback(value);
    setPasswortFeedback(feedback);
    setPasswortStaerke(berechnePasswortStaerke(feedback));
  };

  const handleEmailAendern = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFehler("");
    setEmailErfolg("");
    setEmailLaden(true);

    if (!neueEmail.trim()) {
      setEmailFehler("Bitte gib eine neue E-Mail-Adresse ein.");
      setEmailLaden(false);
      return;
    }

    if (!emailPasswort) {
      setEmailFehler("Bitte gib zur Bestätigung dein aktuelles Passwort ein.");
      setEmailLaden(false);
      return;
    }

    // Re-Authentifizierung mit aktuellem Passwort vor der Änderung
    // (gleiches Sicherheitsmuster wie beim Passwort-Ändern weiter unten)
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: aktuelleEmail,
      password: emailPasswort,
    });

    if (reAuthError) {
      setEmailFehler("Das aktuelle Passwort ist falsch.");
      setEmailLaden(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: neueEmail.trim() });

    if (error) {
      setEmailFehler("Fehler beim Ändern der E-Mail: " + error.message);
    } else {
      setEmailErfolg(
        `Eine Bestätigungsmail wurde an ${neueEmail} geschickt. Bitte klicke den Link in dieser neuen Mail – danach ist die neue Adresse aktiv.`
      );
      setNeueEmail("");
      setEmailPasswort("");
    }
    setEmailLaden(false);
  };

  const handlePasswortAendern = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswortFehler("");
    setPasswortErfolg("");
    setPasswortLaden(true);

    if (neuesPasswort !== passwortBestaetigung) {
      setPasswortFehler("Die neuen Passwörter stimmen nicht überein.");
      setPasswortLaden(false);
      return;
    }

    if (passwortStaerke < 3) {
      setPasswortFehler("Das neue Passwort ist zu schwach. Bitte wähle ein stärkeres.");
      setPasswortLaden(false);
      return;
    }

    const leak = await pruefePasswortLeak(neuesPasswort);
    if (leak.status === "geleakt") {
      setPasswortFehler(PASSWORT_GELEAKT_MELDUNG);
      setPasswortLaden(false);
      return;
    }

    // Bei Dienstausfall gelten weiter die lokalen Regeln; der Wechsel bleibt möglich.
    // Re-Authentifizierung mit aktuellem Passwort vor der Änderung
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: aktuelleEmail,
      password: aktuellesPasswort,
    });

    if (reAuthError) {
      setPasswortFehler("Das aktuelle Passwort ist falsch.");
      setPasswortLaden(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: neuesPasswort });

    if (error) {
      setPasswortFehler("Fehler beim Ändern des Passworts: " + error.message);
    } else {
      setPasswortErfolg("Passwort erfolgreich geändert.");
      setAktuellesPasswort("");
      setNeuesPasswort("");
      setPasswortBestaetigung("");
      setPasswortStaerke(0);
      setPasswortFeedback({
        hasLower: false,
        hasUpper: false,
        hasNumber: false,
        hasSymbol: false,
        hasMinLength: false,
      });
    }
    setPasswortLaden(false);
  };

  return (
    <div className="space-y-10">
      {/* E-Mail ändern */}
      <section>
        <h2 className="font-oswald text-base font-semibold uppercase tracking-wide text-fcb-text mb-1">
          E-Mail-Adresse ändern
        </h2>
        <p className="font-inter text-sm text-fcb-muted mb-4">
          Aktuell: <strong className="text-fcb-text">{aktuelleEmail}</strong>
        </p>

        {emailFehler && <div className="mb-3"><Banner variant="error" message={emailFehler} /></div>}
        {emailErfolg && <div className="mb-3"><Banner variant="success" message={emailErfolg} /></div>}

        <form onSubmit={handleEmailAendern} className="space-y-3">
          <TextField
            label="Neue E-Mail-Adresse"
            type="email"
            value={neueEmail}
            onChange={setNeueEmail}
            placeholder="neue@email.de"
            required
            autoComplete="email"
          />
          <TextField
            label="Aktuelles Passwort"
            type="password"
            value={emailPasswort}
            onChange={setEmailPasswort}
            placeholder="Zur Bestätigung"
            required
            autoComplete="current-password"
          />
          <Button type="submit" variant="primary" size="md" disabled={emailLaden}>
            {emailLaden ? "Wird gesendet …" : "Bestätigungsmail senden"}
          </Button>
        </form>
      </section>

      {/* Passwort ändern */}
      <section>
        <h2 className="font-oswald text-base font-semibold uppercase tracking-wide text-fcb-text mb-4">
          Passwort ändern
        </h2>

        {passwortFehler && <div className="mb-3"><Banner variant="error" message={passwortFehler} /></div>}
        {passwortErfolg && <div className="mb-3"><Banner variant="success" message={passwortErfolg} /></div>}

        <form onSubmit={handlePasswortAendern} className="space-y-4">
          {/* TextField unterstützt kein dynamisches type-Toggle → raw input mit fcb-Tokens */}
          <div className="space-y-1.5">
            <label className="block font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">
              Aktuelles Passwort
            </label>
            <input
              type={passwortAnzeigen ? "text" : "password"}
              value={aktuellesPasswort}
              onChange={(e) => setAktuellesPasswort(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-fcb-border bg-fcb-bg px-3 py-2.5 font-inter text-sm text-fcb-text placeholder:text-fcb-muted/60 transition-colors focus:border-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">
              Neues Passwort
            </label>
            <input
              type={passwortAnzeigen ? "text" : "password"}
              value={neuesPasswort}
              onChange={(e) => handleNeuesPasswortChange(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-fcb-border bg-fcb-bg px-3 py-2.5 font-inter text-sm text-fcb-text placeholder:text-fcb-muted/60 transition-colors focus:border-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40"
            />
            {/* Passwort-Stärke-Anzeige */}
            {neuesPasswort && (
              <div className="mt-2 space-y-1">
                <div className="font-inter text-sm space-y-0.5 text-fcb-muted">
                  <div className={passwortFeedback.hasLower ? "text-green-500" : ""}>
                    {passwortFeedback.hasLower
                      ? <CheckCircle2 size={14} className="inline mr-1 text-green-500" />
                      : <XCircle size={14} className="inline mr-1 text-fcb-muted" />
                    }
                    Kleinbuchstaben
                  </div>
                  <div className={passwortFeedback.hasUpper ? "text-green-500" : ""}>
                    {passwortFeedback.hasUpper
                      ? <CheckCircle2 size={14} className="inline mr-1 text-green-500" />
                      : <XCircle size={14} className="inline mr-1 text-fcb-muted" />
                    }
                    Großbuchstaben
                  </div>
                  <div className={passwortFeedback.hasNumber ? "text-green-500" : ""}>
                    {passwortFeedback.hasNumber
                      ? <CheckCircle2 size={14} className="inline mr-1 text-green-500" />
                      : <XCircle size={14} className="inline mr-1 text-fcb-muted" />
                    }
                    Zahl
                  </div>
                  <div className={passwortFeedback.hasSymbol ? "text-green-500" : ""}>
                    {passwortFeedback.hasSymbol
                      ? <CheckCircle2 size={14} className="inline mr-1 text-green-500" />
                      : <XCircle size={14} className="inline mr-1 text-fcb-muted" />
                    }
                    Sonderzeichen
                  </div>
                  <div className={passwortFeedback.hasMinLength ? "text-green-500" : ""}>
                    {passwortFeedback.hasMinLength
                      ? <CheckCircle2 size={14} className="inline mr-1 text-green-500" />
                      : <XCircle size={14} className="inline mr-1 text-fcb-muted" />
                    }
                    Mind. 8 Zeichen
                  </div>
                </div>
                {/* Stärke-Balken */}
                <div className="h-2 w-full rounded bg-fcb-border overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${passwortStaerkefarbe(passwortStaerke)}`} />
                </div>
                <p className="font-inter text-xs text-fcb-muted">{passwortStaerkeLabel(passwortStaerke)}</p>
              </div>
            )}
          </div>

          {/* Passwort-Bestätigung mit Übereinstimmungs-Icon */}
          <div className="relative space-y-1.5">
            <label className="block font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">
              Neues Passwort bestätigen
            </label>
            <input
              type={passwortAnzeigen ? "text" : "password"}
              value={passwortBestaetigung}
              onChange={(e) => setPasswortBestaetigung(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-fcb-border bg-fcb-bg px-3 py-2.5 pr-10 font-inter text-sm text-fcb-text placeholder:text-fcb-muted/60 transition-colors focus:border-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40"
            />
            {/* Icon am Input ausrichten – bottom-2.5 entspricht der vertikalen Mitte des py-2.5-Inputs */}
            {passwortBestaetigung && (
              <span className="absolute bottom-2.5 right-3">
                {neuesPasswort === passwortBestaetigung ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <XCircle size={18} className="text-fcb-red" />
                )}
              </span>
            )}
          </div>

          <label className="flex items-center gap-2 font-inter text-sm text-fcb-muted cursor-pointer">
            <input
              type="checkbox"
              checked={passwortAnzeigen}
              onChange={() => setPasswortAnzeigen((prev) => !prev)}
              className="accent-fcb-accent"
            />
            Passwörter anzeigen
          </label>

          <Button type="submit" variant="primary" size="md" disabled={passwortLaden}>
            {passwortLaden ? "Wird geändert …" : "Passwort ändern"}
          </Button>
        </form>
      </section>
    </div>
  );
}
