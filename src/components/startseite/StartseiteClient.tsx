"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, ShieldCheck } from "lucide-react";
import HybridCanvas from "@/components/hero/HybridCanvas";
import HybridPitch from "@/components/hero/HybridPitch";
import RotatingText from "@/components/hero/RotatingText";
import InstagramSection from "@/components/instagram/InstagramSection";
import { useTenant } from "@/components/tenant/TenantProvider";
import { RECHTSTEXTE } from "@/lib/rechtstexte";
import { STARTSEITEN_INTRO } from "@/lib/vereinstexte";


/**
 * Homepage – Hybrid-Hero als Startseite.
 *
 * Layering (DOM-Order = Stack-Order bei absolute inset-0):
 *   HybridCanvas       (Dots, pointer-events:none)
 *   HybridPitch        (Spielfeld, pointer-events:none)
 *   Vignette           (Lesbarkeits-Gradient)
 *   Content (z-10)     (Wappen, Headline, Subheadline, 1911-Element)
 *
 * Unterhalb des Heroes: „Vereins-News" – das Instagram-Carousel
 * (InstagramSection lädt den Behold-Feed über /api/instagram).
 *
 * Multi-Tenant: Wappen, Headline, Schlagworte und Zierelement kommen aus der
 * Marken-Konfiguration – dieselbe Hero-Mechanik für FCB und JFG.
 */

export default function StartseiteClient() {
  const tenant = useTenant();
  const intro = STARTSEITEN_INTRO[tenant.id];
  const HEADLINE_LINES = tenant.heroLines;
  const ROTATING_WORDS = tenant.heroWords;
  // Kinderschutz-Ansprechpartner (nach DFB-Merkblatt "Erstellung eines
  // Kinderschutzkonzepts") – nur gesetzt, wenn die Marke ein eigenes Konzept
  // hat (aktuell nur JFG). Homepage-Veröffentlichung ist im Merkblatt
  // ausdrücklich als zulässiger Kommunikationsweg genannt.
  const kinderschutz = RECHTSTEXTE[tenant.id].kinderschutz;

  return (
    <main className="min-h-screen bg-fcb-bg text-fcb-text">

      {/*
       * Hero-Section – folgt jetzt dem globalen Theme:
       * Light = weißer Grund + blaue Linien + dunkler Text.
       * Dark = dunkler Grund wie bisher.
       * Das führende `dark` wurde entfernt, damit fcb-*-Tokens das globale
       * Theme widerspiegeln statt immer auf dunkel zu scopen.
       */}
      <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-fcb-bg">

        {/* Dot-Grid Hintergrund */}
        <HybridCanvas />

        {/* Spielfeld-SVG – liegt über dem Canvas, beide absolute inset-0 */}
        <HybridPitch />

        {/* Vignette für Lesbarkeit des Inhalts – theme-aware via CSS-Vars:
            Dark: --hero-vignette ≈ fast-schwarz, alpha 0.85 → abdunkelnder Rand.
            Light: alpha 0.0 → Vignette praktisch unsichtbar. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 30%, rgb(var(--hero-vignette) / var(--hero-vignette-alpha)) 100%)",
          }}
        />

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-16 pb-24 text-center">

          {/* Wappen mit Glow */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mb-10"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 scale-150 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgb(var(--color-accent) / 0.55) 0%, rgb(var(--color-accent) / 0) 70%)",
              }}
            />
            <Image
              src={tenant.logoSrc}
              alt={tenant.logoAlt}
              width={220}
              height={220}
              priority
              className="drop-shadow-[0_0_24px_rgb(var(--color-accent)/0.6)]"
            />
          </motion.div>

          {/*
           * Headline – drei gleich breite Zeilen:
           *   - Die längste Zeile („BURGKUNSTADT.") bleibt im normalen Block-Flow
           *     und gibt damit die intrinsische Breite der h1 vor.
           *   - Die kürzeren Zeilen werden als `flex justify-between` mit jedem
           *     Buchstaben als eigenem Span gerendert – sie spreizen sich auf
           *     die Container-Breite (= Breite von BURGKUNSTADT.).
           *
           * Hinweis: `text-align-last: justify` würde hier nicht greifen, weil
           * Browser Justify nur zwischen Wörtern verteilen, nicht zwischen
           * Buchstaben innerhalb eines einzelnen Worts.
           *
           * Marken-Akzent: Alle drei Wörter in der Theme-Textfarbe (hell/dunkel),
           * nur der jeweils ERSTE Buchstabe im Marken-Akzent (FCB blau / JFG rot).
           * Keine Umrandung/kein Text-Stroke.
           */}
          {tenant.id === "jfg" ? (
            <>
              {/* Sichtbarer Ersatz für die Text-Headline: die drei Trägervereine.
                  <h1> bleibt für SEO/Screenreader erhalten, aber sr-only – der
                  eigentliche Markenname steht schon größer im Wappen-Alt-Text
                  und im heroBadge darunter. */}
              <h1 className="sr-only">JFG Kunstadt-Obermain</h1>
              <div
                role="group"
                aria-label="Die drei Trägervereine der JFG Kunstadt-Obermain"
                className="flex flex-wrap items-end justify-center gap-6 sm:gap-10"
              >
                {/* Wappenreihe der Trägervereine (tenant.traegervereine) ersetzt
                    die Text-Headline: "FUSSBALL. CHARAKTER. NACHWUCHS." ergab in
                    den Anfangsbuchstaben zufällig "FCN" (Assoziation zum
                    1. FC Nürnberg) und musste raus (2026-07-29, Bastis Wunsch). */}
                {tenant.traegervereine.map((verein, i) => (
                  <motion.div
                    key={verein.name}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.3 + i * 0.18,
                      duration: 0.55,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <Image
                      src={verein.logoSrc}
                      alt={`Wappen ${verein.name}`}
                      width={88}
                      height={88}
                      className="h-16 w-16 object-contain drop-shadow-lg sm:h-[88px] sm:w-[88px]"
                    />
                    <span className="font-inter text-xs uppercase tracking-wide text-fcb-muted">
                      {verein.kurz}
                    </span>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <h1 className="font-oswald font-bold uppercase leading-[0.95] tracking-tight text-fcb-text">
              {/*
               * Schriftgröße: clamp(min(2.25rem,11.25vw), 5vw, 5rem).
               *
               * Das `min()` in der unteren Grenze ist eine Sicherheitsmarge für
               * ultraschmale Geräte. Die alte feste Untergrenze von 2.25rem (36 px)
               * galt für JEDE Breite unter 720 px – „BURGKUNSTADT." ist bei 36 px
               * 237 px breit und hatte damit bei 320 px noch 25 px Luft pro Seite
               * (gemessen, also kein Beschnitt), bei 280 px aber nur noch 5 px.
               * 11.25vw ist so gewählt, dass die Grenze exakt bei 320 px umschlägt:
               * ab 320 px bleibt die Darstellung unverändert bei 36 px, darunter
               * skaliert die Headline proportional mit (280 px → 31.5 px, wieder
               * ~20 px Luft pro Seite). Desktop bleibt vollständig unberührt.
               */}
              {HEADLINE_LINES.map((line, i) => {
                // Längste Zeile bestimmt die Container-Breite (siehe Justify-Hinweis oben).
                const longestLength = Math.max(...HEADLINE_LINES.map((l) => l.length));
                const isLongest = line.length === longestLength;

                const motionProps = {
                  initial: { y: 40, opacity: 0 },
                  animate: { y: 0, opacity: 1 },
                  transition: {
                    delay: 0.3 + i * 0.18,
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                  },
                };

                if (isLongest) {
                  return (
                    <motion.span
                      key={line}
                      {...motionProps}
                      className="block text-[clamp(min(2.25rem,11.25vw),5vw,5rem)]"
                    >
                      {/* Anfangsbuchstabe im Marken-Akzent, Rest erbt die Theme-Textfarbe */}
                      <span className="text-fcb-accent">{line[0]}</span>
                      {line.slice(1)}
                    </motion.span>
                  );
                }

                return (
                  <motion.span
                    key={line}
                    {...motionProps}
                    className="flex justify-between text-[clamp(min(2.25rem,11.25vw),5vw,5rem)]"
                  >
                    {Array.from(line).map((char, idx) => (
                      <span key={idx} className={idx === 0 ? "text-fcb-accent" : undefined}>
                        {char}
                      </span>
                    ))}
                  </motion.span>
                );
              })}
            </h1>
          )}

          {/* Subheadline mit rotierendem Begriff */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            /*
             * Unter `sm` stehen Vorspann und rotierendes Wort untereinander, ab `sm`
             * nebeneinander wie bisher. Zusammen sind beide bei 320–480 px breiter
             * als der Viewport – vorher wurde das Wort deshalb rechts abgeschnitten
             * („ZUSAMMENHA…", Live-Fund 2026-07-30).
             *
             * Bewusst zwei fixe Zeilen statt `flex-wrap`: Beim Umbrechen nach Bedarf
             * hätte die Zeilenzahl je nach Wortlänge zwischen 1 und 2 gewechselt
             * (z. B. bei 360 px passt „Leidenschaft", „Gemeinschaft" nicht) – der
             * Hero wäre bei jedem Wortwechsel vertikal gesprungen. Die Typografie
             * bleibt dadurch unangetastet: das weite 0.4em-Tracking gilt weiter auf
             * allen Breiten, jede Zeile passt einzeln auch bei 320 px.
             */
            className="mt-6 flex flex-col items-center justify-center gap-x-2 gap-y-1 font-inter text-sm uppercase tracking-[0.4em] text-fcb-muted sm:flex-row"
          >
            {/* Der Vorspann bricht nicht mitten im Satz um – entweder ganz oder gar nicht */}
            <span className="whitespace-nowrap">Dein Verein für</span>
            <RotatingText
              words={ROTATING_WORDS}
              interval={2400}
              className="text-fcb-accent font-semibold"
            />
          </motion.p>

          {/*
           * Typografisches CTA-Element – bewusst nicht klickbar.
           * Nutzer gelangen über die Navbar zu Kalender und Login.
           */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.25, duration: 0.5 }}
            className="mt-10 flex items-center justify-center gap-4 sm:gap-5"
          >
            {/* Linke Zierlinie */}
            <span aria-hidden className="h-0.5 w-8 bg-fcb-text/20 sm:w-12" />
            <span className="font-oswald text-base font-bold uppercase tracking-[0.2em] text-fcb-accent sm:text-xl">
              {tenant.heroBadge.links}
            </span>
            <span className="font-oswald text-base font-medium uppercase tracking-[0.2em] text-fcb-text/85 sm:text-xl">
              {tenant.heroBadge.rechts}
            </span>
            {/* Rechte Zierlinie */}
            <span aria-hidden className="h-0.5 w-8 bg-fcb-text/20 sm:w-12" />
          </motion.div>

        </div>
      </section>

      {/* Kurzvorstellung für Besucher und Suchmaschinen: Der Hero enthält kaum
          Fließtext und der Instagram-Feed lädt erst im Browser nach – ohne
          diesen Absatz stünde auf der Startseite kein auslesbarer Satz dazu,
          wer der Verein ist. Text ausschließlich aus belegten Fakten
          (STARTSEITEN_INTRO in vereinstexte.ts). */}
      <section aria-labelledby="startseiten-intro" className="border-t border-fcb-border bg-fcb-surface px-4 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="startseiten-intro" className="font-oswald text-2xl font-semibold uppercase tracking-wide text-fcb-text">
            {intro.heading}
          </h2>
          <p className="mx-auto mt-4 font-inter leading-relaxed text-fcb-text/80">
            {intro.text}
          </p>
        </div>
      </section>

      {/* Kinderschutz-Ansprechpartner – Pflichtangabe nach DFB-Merkblatt zur
          Erstellung eines Kinderschutzkonzepts (Punkt 02: Ansprechpartner im
          Verein als Anlaufstelle; Homepage-Bericht ist dort ausdrücklich als
          zulässiger Kommunikationsweg genannt). Nur sichtbar, wenn die Marke
          ein eigenes Konzept hat. */}
      {kinderschutz && (
        <section className="border-t border-fcb-border bg-fcb-surface px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <ShieldCheck className="h-6 w-6 text-fcb-accent" aria-hidden />
              <h2 className="font-oswald text-2xl font-semibold uppercase tracking-wide text-fcb-text">
                Kinderschutz
              </h2>
            </div>
            <p className="mx-auto max-w-xl font-inter text-sm leading-relaxed text-fcb-text/80">
              Die {tenant.name} hat im Rahmen der DFB/BFV-Vorgaben ein eigenes
              Kinderschutzkonzept erarbeitet. Bei Fragen, Anliegen oder im
              Ernstfall erreichst du diese Ansprechpartner – vertraulich und
              jederzeit:
            </p>
            <div className="mx-auto mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-fcb-border bg-fcb-bg p-5 text-left">
                <p className="font-inter text-xs font-medium uppercase tracking-wide text-fcb-muted">
                  Interner Ansprechpartner
                </p>
                <p className="mt-1 font-oswald text-lg font-semibold uppercase tracking-wide text-fcb-text">
                  {kinderschutz.intern.name}
                </p>
                {kinderschutz.intern.telefonHref && (
                  <Link
                    href={kinderschutz.intern.telefonHref}
                    className="mt-2 inline-flex items-center gap-1.5 font-inter text-sm text-fcb-accent hover:underline"
                  >
                    <Phone size={14} aria-hidden />
                    {kinderschutz.intern.telefon}
                  </Link>
                )}
              </div>
              <div className="rounded-2xl border border-fcb-border bg-fcb-bg p-5 text-left">
                <p className="font-inter text-xs font-medium uppercase tracking-wide text-fcb-muted">
                  Externer Ansprechpartner
                </p>
                <p className="mt-1 font-oswald text-lg font-semibold uppercase tracking-wide text-fcb-text">
                  {kinderschutz.extern.name}
                </p>
                {kinderschutz.extern.telefonHref && (
                  <Link
                    href={kinderschutz.extern.telefonHref}
                    className="mt-2 inline-flex items-center gap-1.5 font-inter text-sm text-fcb-accent hover:underline"
                  >
                    <Phone size={14} aria-hidden />
                    {kinderschutz.extern.telefon}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Vereins-News – Instagram-Carousel (ersetzt den früheren LightWidget-Feed) */}
      <InstagramSection />

    </main>
  );
}
