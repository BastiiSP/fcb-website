"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseClient";
import PitchAuthShell from "@/components/auth/PitchAuthShell";
import AuthTextField from "@/components/auth/AuthTextField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import AuthInfoBanner from "@/components/auth/AuthInfoBanner";
import AuthSwitchPrompt from "@/components/auth/AuthSwitchPrompt";

const GOOGLE_HINWEIS =
  "Du meldest dich mit Google an? Dann brauchst du kein Passwort – nutze auf der Login-Seite „Mit Google anmelden“.";

export default function PasswortVergessenSeite() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gesendet, setGesendet] = useState(false);

  const handleAnfordern = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    setLaeuft(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Rücksprung auf die aufrufende Domain – die Mailmarke kommt dagegen aus
        // user_metadata.verein (siehe supabase/templates/).
        redirectTo: `${window.location.origin}/passwort-neu`,
      });
      if (error && isAuthRetryableFetchError(error)) {
        // Netz-/Serverausfall betrifft alle Adressen gleich und verrät nichts über Konten.
        setFehler("Die Anfrage konnte gerade nicht gesendet werden. Bitte versuche es später erneut.");
        return;
      }
      // Alle übrigen Fehler (z. B. Ratenlimit pro Adresse) bewusst wie Erfolg
      // behandeln: Eine abweichende Meldung würde verraten, dass ein Konto existiert.
      if (error) console.error("Supabase-Fehler beim Passwort-Reset:", error.message);
      setGesendet(true);
    } catch (error) {
      console.error("Supabase-Fehler beim Passwort-Reset:", error);
      setFehler("Die Anfrage konnte gerade nicht gesendet werden. Bitte versuche es später erneut.");
    } finally {
      setLaeuft(false);
    }
  };

  if (gesendet) {
    return (
      <PitchAuthShell>
        <div className="mt-7 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fcb-accent/40 bg-fcb-accent/10 text-fcb-accent">
            <MailCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Prüfe dein Postfach
          </h1>
          <p className="mt-3 font-inter text-sm leading-relaxed text-fcb-muted">
            Falls zu <span className="text-fcb-text">{email.trim()}</span> ein Konto
            existiert, haben wir dir eine E-Mail geschickt. Der Link darin ist nur
            begrenzt gültig und lässt sich einmal verwenden.
          </p>
          <div className="mt-5 w-full space-y-3 text-left">
            <AuthInfoBanner message="Keine Mail erhalten? Schau im Spam-Ordner nach und fordere den Link sonst in ein paar Minuten erneut an." />
            <AuthInfoBanner message={GOOGLE_HINWEIS} />
          </div>
          <Link
            href="/login"
            className="mt-6 w-full rounded-lg bg-fcb-accent px-4 py-3 text-center font-oswald text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-fcb-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fcb-bg"
          >
            Zum Login
          </Link>
        </div>
      </PitchAuthShell>
    );
  }

  return (
    <PitchAuthShell>
      <form onSubmit={handleAnfordern} className="mt-7 space-y-5">
        <div className="text-center">
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Passwort vergessen
          </h1>
          <p className="mt-1 font-inter text-sm text-fcb-muted">
            Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.
          </p>
        </div>
        <AuthTextField
          label="E-Mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthInfoBanner message={GOOGLE_HINWEIS} />
        <AuthErrorBanner message={fehler} />
        <AuthSubmitButton disabled={!email.trim() || laeuft}>
          {laeuft ? "Wird gesendet …" : "Link anfordern"}
        </AuthSubmitButton>
        <AuthSwitchPrompt frage="Passwort wieder eingefallen?" aktion="Zum Login" href="/login" />
      </form>
    </PitchAuthShell>
  );
}
