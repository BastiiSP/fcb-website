"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { spotlightMove, SpotlightOverlays } from "@/components/instagram/Spotlight";
import { InstagramIcon } from "@/components/icons/BrandIcons";
import { instagramBildAlt } from "@/lib/instagramAlt";
import {
  formatPostDate,
  splitCaption,
  type InstaPost,
} from "@/lib/beholdFeed";

// Große News-Card für einen Instagram-Post (News-Seite): alle Bilder des
// Posts als durchscrollbares Carousel, Volltext-Caption mit „Mehr lesen",
// Datum und Link zum Original. Kein Auto-Rotate – Lesekontext.

/** Ab dieser Textlänge wird die Caption eingeklappt, damit die Liste scannbar bleibt. */
const CLAMP_LAENGE = 400;

interface NewsPostCardProps {
  post: InstaPost;
}

export default function NewsPostCard({ post }: NewsPostCardProps) {
  const [bildIndex, setBildIndex] = useState(0);
  const [ausgeklappt, setAusgeklappt] = useState(false);
  const reduceMotion = useReducedMotion();

  const { heading, body } = splitCaption(post.caption);
  const datum = formatPostDate(post.timestamp);

  const bilder = post.images.length > 0 ? post.images : null;
  const mehrere = (bilder?.length ?? 0) > 1;

  const istLang = body.length > CLAMP_LAENGE;
  const sichtbarerText =
    istLang && !ausgeklappt ? `${body.slice(0, CLAMP_LAENGE).trimEnd()} …` : body;

  const zurueck = () =>
    setBildIndex((i) => (i - 1 + (bilder?.length ?? 1)) % (bilder?.length ?? 1));
  const weiter = () => setBildIndex((i) => (i + 1) % (bilder?.length ?? 1));

  return (
    <motion.article
      initial={reduceMotion ? false : { y: 16, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Spotlight-Glow wie beim Homepage-Carousel. Der onMouseMove muss auf
          der .spotlight-card selbst liegen: deren --mx/--my-Defaults würden
          auf einem Eltern-Element gesetzte Werte überschreiben. */}
      <Card
        padding="none"
        className="spotlight-card overflow-hidden"
        onMouseMove={spotlightMove}
      >
        <SpotlightOverlays />
        {/* Bildbereich – quadratisch wie auf Instagram, Bilder werden mittig beschnitten */}
        {bilder && (
          <div className="relative aspect-square w-full overflow-hidden bg-fcb-bg">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={bildIndex}
                initial={reduceMotion ? false : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -40 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="absolute inset-0"
                // Touch-Swipe: horizontales Ziehen blättert weiter/zurück
                drag={mehrere ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) weiter();
                  else if (info.offset.x > 60) zurueck();
                }}
              >
                <Image
                  src={bilder[bildIndex].url}
                  alt={instagramBildAlt(post.timestamp, bildIndex + 1, bilder.length)}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="object-cover"
                  // Erstes Bild des obersten Posts lädt priorisiert genug via viewport
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>

            {mehrere && (
              <>
                {/* Blätter-Buttons */}
                <button
                  type="button"
                  onClick={zurueck}
                  aria-label="Vorheriges Bild"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-fcb-bg/60 p-2 text-fcb-text backdrop-blur-sm transition-colors hover:bg-fcb-bg/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
                >
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={weiter}
                  aria-label="Nächstes Bild"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-fcb-bg/60 p-2 text-fcb-text backdrop-blur-sm transition-colors hover:bg-fcb-bg/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
                >
                  <ChevronRight size={20} aria-hidden />
                </button>

                {/* Bildzähler */}
                <span className="absolute right-3 top-3 rounded-full bg-fcb-bg/60 px-2.5 py-0.5 font-inter text-xs font-medium text-fcb-text backdrop-blur-sm">
                  {bildIndex + 1}/{bilder.length}
                </span>

                {/* Punkt-Indikatoren */}
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {bilder.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBildIndex(i)}
                      aria-label={`Bild ${i + 1} anzeigen`}
                      aria-current={i === bildIndex}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i === bildIndex ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Textbereich */}
        <div className="p-6">
          {/* Meta-Zeile: Datum */}
          {datum && (
            <p className="flex items-center gap-2 font-inter text-xs text-fcb-muted">
              <Calendar size={16} aria-hidden />
              {datum}
            </p>
          )}

          {heading && (
            <h2 className="mt-2 font-oswald text-xl font-semibold uppercase tracking-wide text-fcb-text">
              {heading}
            </h2>
          )}

          {sichtbarerText && (
            <p className="mt-3 whitespace-pre-line font-inter text-sm leading-relaxed text-fcb-text/80">
              {sichtbarerText}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {istLang && (
              <button
                type="button"
                onClick={() => setAusgeklappt((v) => !v)}
                className="font-inter text-sm font-medium text-fcb-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
              >
                {ausgeklappt ? "Weniger anzeigen" : "Mehr lesen"}
              </button>
            )}

            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-2 font-inter text-sm font-medium text-fcb-muted transition-colors hover:text-fcb-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
            >
              <InstagramIcon className="h-4 w-4" aria-hidden />
              Auf Instagram ansehen
            </a>
          </div>
        </div>
      </Card>
    </motion.article>
  );
}
