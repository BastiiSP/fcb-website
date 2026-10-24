"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  hatMailLinkFehler,
  istPasswortkonto,
  leseMailLinkParameter,
} from "@/lib/auth/emailLink";
import {
  PASSWORT_GELEAKT_MELDUNG,
  berechnePasswortFeedback,
  berechnePasswortStaerke,
  pruefePasswortLeak,
} from "@/utils/passwortStaerke";
import PitchAuthShell from "@/components/auth/PitchAuthShell";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import AuthInfoBanner from "@/components/auth/AuthInfoBanner";

type Phase = "laden" | "formular" | "linkUngueltig" | "keinPasswortkonto" | "fertig";

const CTA_KLASSEN =
  "mt-6 w-full rounded-lg bg-fcb-accent px-4 py-3 text-center font-oswald text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-fcb-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fcb-bg";

export default function PasswortNeuSeite() {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("laden");
  const [tokenHash, setTokenHash] = useState("");
  // Nach erfolgreichem verifyOtp ist der Token verbraucht. Scheitert danach nur
  // updateUser (z. B. gleiches Passwort), darf ein zweiter Versuch die
  // Recovery-Sitzung weiterverwenden statt erneut zu verifizieren.
  const [verifiziert, setVerifiziert] = useState(false);
  const [passwort, setPasswort] = useState("");
  const [passwortBestaetigung, setPasswortBestaetigung] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const feedback = useMemo(() => berechnePasswortFeedback(passwort), [passwort]);
  const staerke = useMemo(() => berechnePasswortStaerke(feedback), [feedback]);
  const passwoerterGleich = passwort.length > 0 && passwort === passwortBestaetigung;

  useEffect(() => {
    // Bewusst nur das token_hash-Format aus supabase/templates/reset-password.html.
    // Ohne Token darf die Seite kein Formular zeigen: Sonst könnte jede bereits
    // eingeloggte Sitzung hier ohne aktuelles Passwort ein neues setzen und die
    // Re-Authentifizierung im Profil umgehen.
    const { search, hash } = window.location;
    const parameter = leseMailLinkParameter(search);
    if (hatMailLinkFehler(search, hash) || !parameter || parameter.typ !== "recovery") {
      setPhase("linkUngueltig");
      return;
    }
    setTokenHash(parameter.tokenHash);
    setPhase("formular");
  }, []);

  const handleSpeichern = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    if (!passwoerterGleich) {
      setFehler("Die Passwörter stimmen nicht überein.");
      return;
    }
    // Gleiche Regeln wie beim Passwortwechsel im Profil (AccountSicherheit) plus
    // die Mindestlänge der Registrierung.
    if (passwort.length < 8 || staerke < 3) {
      setFehler("Das neue Passwort ist zu schwach. Bitte wähle ein stärkeres.");
      return;
    }
    setLaeuft(true);
    try {
      const leak = await pruefePasswortLeak(passwort);
      if (leak.status === "geleakt") {
        setFehler(PASSWORT_GELEAKT_MELDUNG);
        return;
      }
      // Bei unbekanntem Leak-Status gelten weiter die lokalen Regeln (wie im Profil).

      if (!verifiziert) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          // Supabase unterscheidet abgelaufen/verbraucht/manipuliert nicht
          // (einheitlich otp_expired) – deshalb eine gemeinsame Meldung.
          console.error("Supabase-Fehler beim Einlösen des Reset-Links:", error.message);
          setPhase("linkUngueltig");
          return;
        }
        if (!istPasswortkonto(data.user)) {
          // Zweite Ebene zur Reset-Vorlage: Reine Google-Konten bekommen kein
          // Website-Passwort. Nur diese Recovery-Sitzung beenden, nicht die
          // Google-Sitzungen des Nutzers auf anderen Geräten.
          await supabase.auth.signOut({ scope: "local" });
          setPhase("keinPasswortkonto");
          return;
        }
        setVerifiziert(true);
      }

      const { error } = await supabase.auth.updateUser({ password: passwort });
      if (error) {
        console.error("Supabase-Fehler beim Setzen des Passworts:", error.message);
        if (error.code === "same_password") {
          setFehler("Das neue Passwort muss sich von deinem bisherigen unterscheiden.");
        } else if (error.code === "weak_password") {
          setFehler("Das neue Passwort ist zu schwach. Bitte wähle ein stärkeres.");
        } else {
          setFehler("Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.");
        }
        return;
      }

      // Andere Geräte abmelden: Wer sein Passwort zurücksetzt, will ggf. einen
      // fremden Zugriff beenden. Ein Fehler hier blockiert den Erfolg nicht.
      const { error: abmeldeFehler } = await supabase.auth.signOut({ scope: "others" });
      if (abmeldeFehler) console.error("Andere Sitzungen nicht beendet:", abmeldeFehler.message);
      setPhase("fertig");
    } catch (error) {
      console.error("Supabase-Fehler beim Passwort-Reset:", error);
      setFehler("Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setLaeuft(false);
    }
  };

  if (phase === "laden") {
    return (
      <PitchAuthShell>
        <p className="mt-7 text-center font-inter text-sm text-fcb-muted">Link wird geprüft …</p>
      </PitchAuthShell>
    );
  }

  if (phase === "linkUngueltig" || phase === "keinPasswortkonto" || phase === "fertig") {
    const inhalt = {
      linkUngueltig: {
        icon: LinkIcon,
        titel: "Link ungültig",
        text: "Dieser Link ist abgelaufen, wurde bereits verwendet oder ist unvollständig. Fordere einfach einen neuen an.",
        ctaText: "Neuen Link anfordern",
        ctaHref: "/passwort-vergessen",
      },
      keinPasswortkonto: {
        icon: KeyRound,
        titel: "Anmeldung über Google",
        text: "Für dein Konto ist keine Anmeldung mit Website-Passwort eingerichtet. Melde dich bitte wie gewohnt mit „Mit Google anmelden“ an.",
        ctaText: "Zum Login",
        ctaHref: "/login",
      },
      fertig: {
        icon: CheckCircle2,
        titel: "Passwort gespeichert",
        text: "Dein neues Passwort ist aktiv und du bist angemeldet. Auf anderen Geräten musst du dich neu anmelden.",
        ctaText: "Zur Startseite",
        ctaHref: "/",
      },
    }[phase];
    const Icon = inhalt.icon;
    return (
      <PitchAuthShell>
        <div className="mt-7 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fcb-accent/40 bg-fcb-accent/10 text-fcb-accent">
            <Icon className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            {inhalt.titel}
          </h1>
          <p className="mt-3 font-inter text-sm leading-relaxed text-fcb-muted">{inhalt.text}</p>
          {phase === "fertig" ? (
            // Hard-Reload wie beim Login: Header/Session-Status sauber neu aufbauen.
            <a href={inhalt.ctaHref} className={CTA_KLASSEN}>
              {inhalt.ctaText}
            </a>
          ) : (
            <Link href={inhalt.ctaHref} className={CTA_KLASSEN}>
              {inhalt.ctaText}
            </Link>
          )}
        </div>
      </PitchAuthShell>
    );
  }

  return (
    <PitchAuthShell>
      <form onSubmit={handleSpeichern} className="mt-7 space-y-5">
        <div className="text-center">
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Neues Passwort
          </h1>
          <p className="mt-1 font-inter text-sm text-fcb-muted">
            Lege ein neues Passwort für dein Konto fest.
          </p>
        </div>
        <AuthPasswordField label="Neues Passwort" value={passwort} onChange={setPasswort} autoComplete="new-password" />
        <PasswordStrengthMeter feedback={feedback} staerke={staerke} />
        <AuthPasswordField
          label="Neues Passwort bestätigen"
          value={passwortBestaetigung}
          onChange={setPasswortBestaetigung}
          autoComplete="new-password"
        />
        <AuthInfoBanner message="Der Link aus der Mail wird erst beim Speichern eingelöst und ist danach verbraucht." />
        <AuthErrorBanner message={fehler} />
        <AuthSubmitButton disabled={!passwoerterGleich || laeuft}>
          {laeuft ? "Wird gespeichert …" : "Passwort speichern"}
        </AuthSubmitButton>
      </form>
    </PitchAuthShell>
  );
}
