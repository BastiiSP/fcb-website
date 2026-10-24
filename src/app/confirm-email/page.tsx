"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LinkIcon, MailCheck, MailOpen } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { hatMailLinkFehler, leseMailLinkParameter } from "@/lib/auth/emailLink";
import PitchAuthShell from "@/components/auth/PitchAuthShell";
import AuthInfoBanner from "@/components/auth/AuthInfoBanner";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { useTenant } from "@/components/tenant/TenantProvider";

/**
 * Ziel der Links aus „Confirm signup“ und „Change email“.
 *
 * Neues Format (supabase/templates/): `?token_hash=…&type=signup|email_change`.
 * Der Link wird erst per Klick eingelöst, damit Mail-Scanner ihn nicht verbrauchen.
 *
 * Altes Format (Mails, die vor dem Vorlagenwechsel verschickt wurden): Supabase
 * hat bereits verifiziert und hängt Tokens bzw. einen Fehler an die URL. Den Typ
 * (Registrierung oder E-Mail-Änderung) verrät das alte Format nicht zuverlässig,
 * weil supabase-js den Hash beim Einlesen leert – deshalb dort ein neutraler Erfolg.
 */
type Phase =
  | "laden"
  | "bereit"
  | "registriert"
  | "emailGeaendert"
  | "emailHalb"
  | "bestaetigt"
  | "linkUngueltig";

type LinkTyp = "signup" | "email_change";

const CTA_KLASSEN =
  "mt-6 w-full rounded-lg bg-fcb-accent px-4 py-3 text-center font-oswald text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-fcb-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fcb-bg";
const NEBENLINK_KLASSEN =
  "mt-3 font-inter text-sm font-medium text-fcb-muted underline-offset-2 transition-colors hover:text-fcb-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent";

export default function ConfirmEmailPage() {
  const supabase = createClient();
  const tenant = useTenant();
  const [phase, setPhase] = useState<Phase>("laden");
  const [linkTyp, setLinkTyp] = useState<LinkTyp>("signup");
  const [tokenHash, setTokenHash] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    const { search, hash } = window.location;
    if (hatMailLinkFehler(search, hash)) {
      setPhase("linkUngueltig");
      return;
    }
    const parameter = leseMailLinkParameter(search);
    if (parameter && (parameter.typ === "signup" || parameter.typ === "email_change")) {
      setLinkTyp(parameter.typ);
      setTokenHash(parameter.tokenHash);
      setPhase("bereit");
      return;
    }
    // Altes Format: getSession wartet, bis supabase-js die Tokens aus der URL
    // übernommen hat. Ohne Sitzung gibt es nichts, was bestätigt wurde.
    let abgebrochen = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (abgebrochen) return;
      setPhase(data.session ? "bestaetigt" : "linkUngueltig");
    });
    return () => {
      abgebrochen = true;
    };
  }, [supabase]);

  const handleBestaetigen = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    setLaeuft(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: linkTyp });
      if (error) {
        console.error("Supabase-Fehler beim Bestätigen:", error.message);
        setPhase("linkUngueltig");
        return;
      }
      if (linkTyp === "signup") {
        setPhase("registriert");
      } else {
        // Bei „Secure email change“ braucht es die Links an alte UND neue Adresse.
        // Nach dem ersten liefert Supabase Erfolg, aber noch keine Sitzung.
        setPhase(data.session ? "emailGeaendert" : "emailHalb");
      }
    } catch (error) {
      console.error("Supabase-Fehler beim Bestätigen:", error);
      setFehler("Die Bestätigung hat gerade nicht geklappt. Bitte versuche es erneut.");
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

  if (phase === "bereit") {
    const istRegistrierung = linkTyp === "signup";
    return (
      <PitchAuthShell>
        <form onSubmit={handleBestaetigen} className="mt-7 flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fcb-accent/40 bg-fcb-accent/10 text-fcb-accent">
            <MailOpen className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            {istRegistrierung ? "E-Mail bestätigen" : "Neue Adresse bestätigen"}
          </h1>
          <p className="font-inter text-sm leading-relaxed text-fcb-muted">
            {istRegistrierung
              ? "Ein Klick noch: Bestätige deine E-Mail-Adresse, um die Registrierung abzuschließen."
              : "Ein Klick noch: Bestätige die Änderung deiner E-Mail-Adresse."}
          </p>
          <div className="w-full text-left">
            <AuthErrorBanner message={fehler} />
          </div>
          <AuthSubmitButton disabled={laeuft}>
            {laeuft ? "Wird bestätigt …" : "Jetzt bestätigen"}
          </AuthSubmitButton>
        </form>
      </PitchAuthShell>
    );
  }

  if (phase === "registriert") {
    return (
      <PitchAuthShell>
        <div className="mt-7 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fcb-accent/40 bg-fcb-accent/10 text-fcb-accent">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-oswald text-3xl font-bold uppercase tracking-wide text-fcb-text">
            Willkommen {tenant.kurznameDativ}
          </h1>
          <p className="mt-3 font-inter text-sm leading-relaxed text-fcb-muted">
            Deine E-Mail-Adresse wurde erfolgreich bestätigt. Dein Konto wird
            geprüft und freigeschaltet. Bei Fragen wende dich an die Vorstandschaft
            oder den IT-Verantwortlichen.
          </p>
          <div className="mt-5 w-full">
            <AuthInfoBanner message="Vervollständige schon jetzt dein Profil – so können wir dich schneller zuordnen und freischalten." />
          </div>
          {/* Hard-Reload: Header/Session-Status nach frischer Anmeldung sauber aufbauen */}
          <a href="/profil" className={CTA_KLASSEN}>
            Profil vervollständigen
          </a>
          <Link href="/" className={NEBENLINK_KLASSEN}>
            Später, zur Startseite
          </Link>
        </div>
      </PitchAuthShell>
    );
  }

  const inhalt = {
    emailGeaendert: {
      icon: CheckCircle2,
      titel: "E-Mail geändert",
      text: "Deine neue E-Mail-Adresse ist jetzt aktiv. Melde dich künftig mit dieser Adresse an.",
      ctaText: "Zum Profil",
      ctaHref: "/profil",
      nebenText: "Zur Startseite",
      nebenHref: "/",
    },
    emailHalb: {
      icon: MailCheck,
      titel: "Fast geschafft",
      text: "Dieser Link ist bestätigt. Aus Sicherheitsgründen musst du die Änderung zusätzlich über den Link in der Mail an deine andere Adresse bestätigen.",
      ctaText: "Zur Startseite",
      ctaHref: "/",
      nebenText: "",
      nebenHref: "",
    },
    bestaetigt: {
      icon: CheckCircle2,
      titel: "Bestätigt",
      text: "Deine E-Mail-Adresse wurde bestätigt.",
      ctaText: "Zum Profil",
      ctaHref: "/profil",
      nebenText: "Zur Startseite",
      nebenHref: "/",
    },
    linkUngueltig: {
      icon: LinkIcon,
      titel: "Link ungültig",
      text: "Dieser Link ist abgelaufen, wurde bereits verwendet oder ist unvollständig. Wurde deine Adresse schon bestätigt, kannst du dich einfach anmelden. Eine E-Mail-Änderung forderst du im Profil neu an.",
      ctaText: "Zum Login",
      ctaHref: "/login",
      nebenText: "Zum Profil",
      nebenHref: "/profil",
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
        <a href={inhalt.ctaHref} className={CTA_KLASSEN}>
          {inhalt.ctaText}
        </a>
        {inhalt.nebenText && (
          <Link href={inhalt.nebenHref} className={NEBENLINK_KLASSEN}>
            {inhalt.nebenText}
          </Link>
        )}
      </div>
    </PitchAuthShell>
  );
}
