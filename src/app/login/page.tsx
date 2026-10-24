"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import { signInWithGoogle } from "@/lib/auth/signInWithGoogle";
import PitchAuthShell from "@/components/auth/PitchAuthShell";
import GoogleButton from "@/components/auth/GoogleButton";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthTextField from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import AuthInfoBanner from "@/components/auth/AuthInfoBanner";
import AuthSwitchPrompt from "@/components/auth/AuthSwitchPrompt";
import RotatingText from "@/components/hero/RotatingText";
import { useTenant } from "@/components/tenant/TenantProvider";

export default function LoginPage() {
  const supabase = createClient();
  // Rotierende Schlagworte pro Marke – „1911" gilt nur für den FCB.
  const tenant = useTenant();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [googleHinweis, setGoogleHinweis] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: passwort,
    });
    if (error) {
      setFehler("Login fehlgeschlagen. Bitte überprüfe deine Daten.");
    } else {
      // Hard-Reload wie bisher: Header/Session-Status sauber neu aufbauen.
      window.location.href = "/";
    }
  };

  const handleGoogle = async () => {
    setGoogleHinweis("");
    const { error } = await signInWithGoogle();
    // Tritt z. B. auf, solange der Google-Provider noch nicht freigeschaltet ist.
    if (error) setGoogleHinweis("Google-Anmeldung ist derzeit nicht verfügbar.");
  };

  return (
    <PitchAuthShell>
      <form onSubmit={handleLogin} className="mt-7 space-y-5">
        <div className="text-center">
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Willkommen zurück
          </h1>
          <p className="mt-1 font-inter text-sm text-fcb-muted">
            Dein Verein, deine{" "}
            <RotatingText
              words={tenant.authWords}
              clip={false}
              className="font-oswald font-semibold uppercase tracking-wide text-fcb-accent"
            />
          </p>
        </div>

        <GoogleButton modus="login" onClick={handleGoogle} />
        <AuthInfoBanner message={googleHinweis} />
        <AuthDivider />
        <AuthTextField
          label="E-Mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthPasswordField
          label="Passwort"
          value={passwort}
          onChange={setPasswort}
          autoComplete="current-password"
        />
        <div className="-mt-2 text-right">
          <Link
            href="/passwort-vergessen"
            className="font-inter text-sm font-medium text-fcb-accent underline-offset-2 transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
          >
            Passwort vergessen?
          </Link>
        </div>
        <AuthErrorBanner message={fehler} />
        <AuthSubmitButton>Einloggen</AuthSubmitButton>
        <AuthSwitchPrompt frage="Noch kein Konto?" aktion="Jetzt registrieren" href="/registrieren" />
      </form>
    </PitchAuthShell>
  );
}
