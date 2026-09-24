"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { signInWithGoogle } from "@/lib/auth/signInWithGoogle";
import {
  berechnePasswortFeedback,
  berechnePasswortStaerke,
} from "@/utils/passwortStaerke";
import PitchAuthShell from "@/components/auth/PitchAuthShell";
import GoogleButton from "@/components/auth/GoogleButton";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthTextField from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import AuthInfoBanner from "@/components/auth/AuthInfoBanner";
import AuthSwitchPrompt from "@/components/auth/AuthSwitchPrompt";
import { useTenant } from "@/components/tenant/TenantProvider";

export default function RegistrierungsSeite() {
  const supabase = createClient();
  const tenant = useTenant();
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [passwortBestaetigung, setPasswortBestaetigung] = useState("");
  const [fehler, setFehler] = useState("");
  const [googleHinweis, setGoogleHinweis] = useState("");
  const [abgeschlossen, setAbgeschlossen] = useState(false);

  const feedback = useMemo(() => berechnePasswortFeedback(passwort), [passwort]);
  const staerke = useMemo(() => berechnePasswortStaerke(feedback), [feedback]);
  const passwoerterGleich =
    passwort.length > 0 && passwort === passwortBestaetigung;
  // Mindestlänge 8 (konsistent mit Stärke-Meter; vorher Legacy 6).
  const gueltig =
    Boolean(vorname && nachname && email) &&
    passwort.length >= 8 &&
    passwoerterGleich;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    if (!vorname || !nachname) {
      setFehler("Bitte Vor- und Nachname ausfüllen.");
      return;
    }
    if (!passwoerterGleich) {
      setFehler("Die Passwörter stimmen nicht überein.");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password: passwort,
      options: {
        // origin-relativ: lokal, Preview und Produktion zeigen jeweils korrekt
        // (vorher hart auf www.fcbuku.de verdrahtet).
        emailRedirectTo: `${window.location.origin}/confirm-email`,
        // Telefonnummer entfällt bewusst – Trigger schreibt dann NULL.
        // Der Tenant befüllt profiles.verein bei der Registrierung vor; nur
        // Admins dürfen diese Zuordnung später ändern.
        data: { vorname, nachname, verein: tenant.id },
      },
    });
    if (error) {
      console.error("Supabase-Fehler:", error.message);
      setFehler(`Registrierung fehlgeschlagen: ${error.message}`);
    } else {
      setAbgeschlossen(true);
    }
  };

  const handleGoogle = async () => {
    setGoogleHinweis("");
    const { error } = await signInWithGoogle();
    if (error) setGoogleHinweis("Google-Anmeldung ist derzeit nicht verfügbar.");
  };

  // --- Zwischenseite nach erfolgreichem Absenden ("E-Mail bestätigen") ---
  if (abgeschlossen) {
    return (
      <PitchAuthShell>
        <div className="mt-7 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fcb-accent/40 bg-fcb-accent/10 text-fcb-accent">
            <MailCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Fast geschafft
          </h1>
          <p className="mt-3 font-inter text-sm leading-relaxed text-fcb-muted">
            Wir haben dir eine Bestätigungs-E-Mail an{" "}
            <span className="text-fcb-text">{email}</span> geschickt. Bitte
            klicke den Link in der Mail. Dein Konto wird geprüft und
            freigeschaltet. Bei Fragen wende dich an die Vorstandschaft oder den
            IT-Verantwortlichen.
          </p>
          <div className="mt-5 w-full">
            <AuthInfoBanner message="Keine Mail erhalten? Schau im Spam-Ordner nach." />
          </div>
          {/* Prominenter CTA statt unscheinbarem Text-Link */}
          <Link
            href="/"
            className="mt-6 w-full rounded-lg bg-fcb-accent px-4 py-3 text-center font-oswald text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-fcb-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fcb-bg"
          >
            Zur Startseite
          </Link>
        </div>
      </PitchAuthShell>
    );
  }

  // --- Formular ---
  return (
    <PitchAuthShell>
      <form onSubmit={handleRegister} className="mt-7 space-y-5">
        <div className="text-center">
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Werde Teil des Vereins
          </h1>
          <p className="mt-1 font-inter text-sm text-fcb-muted">
            Registrieren und dabei sein
          </p>
        </div>

        <GoogleButton modus="register" onClick={handleGoogle} />
        <AuthInfoBanner message={googleHinweis} />
        <AuthDivider />

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthTextField label="Vorname" value={vorname} onChange={setVorname} autoComplete="given-name" required />
          <AuthTextField label="Nachname" value={nachname} onChange={setNachname} autoComplete="family-name" required />
        </div>
        <AuthTextField label="E-Mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <AuthPasswordField label="Passwort" value={passwort} onChange={setPasswort} autoComplete="new-password" />
        <PasswordStrengthMeter feedback={feedback} staerke={staerke} />
        <AuthPasswordField
          label="Passwort bestätigen"
          value={passwortBestaetigung}
          onChange={setPasswortBestaetigung}
          autoComplete="new-password"
        />
        <AuthErrorBanner message={fehler} />
        <AuthSubmitButton disabled={!gueltig}>Jetzt registrieren</AuthSubmitButton>
        <AuthSwitchPrompt frage="Bereits registriert?" aktion="Hier einloggen" href="/login" />
      </form>
    </PitchAuthShell>
  );
}
