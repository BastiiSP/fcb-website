"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type InstaPost, formatPostDate, splitCaption } from "@/lib/beholdFeed";
import { instagramBildAlt } from "@/lib/instagramAlt";
import { spotlightMove, SpotlightOverlays } from "./Spotlight";
import InstagramOverlay from "./InstagramOverlay";

/**
 * Finale Instagram-Carousel-Variante (Runde 3): Feature-Mechanik (Variante D)
 * mit Zwei-Zonen-Card-Design (Variante A).
 *
 * Mechanik (D): zentrierter Hauptpost, Nachbarn verkleinert + unscharf,
 * Auto-Wechsel alle 4 s (Pause bei Hover), Pfeil-Navigation und Touch-Swipe.
 * Card-Design (A): Bild oben (4:5), darunter ein abgetrennter Textbereich mit
 * Datum + Caption – kein Text-Overlay im Bild. Bild und Text wechseln als
 * Einheit (die ganze Card bewegt sich per CSS-Transition).
 *
 * Homepage-fertig: in sich geschlossen, nutzt FCB-Tokens, kann direkt in
 * page.tsx eingesetzt werden.
 */
const AUTO_MS = 4000;
const SWIPE_THRESHOLD = 40; // px – ab hier zählt eine Wischgeste

export default function InstagramCarousel({ posts }: { posts: InstaPost[] }) {
  const total = posts.length;
  const [current, setCurrent] = useState(Math.floor(total / 2));
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % total), [total]);
  const prev = () => setCurrent((c) => (c - 1 + total) % total);

  // Auto-Wechsel; pausiert bei Hover (Desktop).
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, AUTO_MS);
    return () => clearInterval(timer);
  }, [next, paused]);

  // Touch-Swipe für Mobilgeräte (dort keine Hover-Interaktion).
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  return (
    <div
      // overflow-hidden: verhindert horizontalen Scroll durch Adjacent-Cards (translateX ±54%)
      className="relative mx-auto flex w-full max-w-5xl items-center justify-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative flex h-[520px] w-full items-center justify-center [perspective:1200px] md:h-[620px]">
        {posts.map((post, index) => {
          // Position relativ zum aktiven Post in den Bereich [-half, +half].
          let pos = (index - current + total) % total;
          if (pos > Math.floor(total / 2)) pos -= total;
          const isCenter = pos === 0;
          const isAdjacent = Math.abs(pos) === 1;
          // Erste Zeile als Überschrift abtrennen, restliche Absätze als Fließtext.
          const { heading, body } = splitCaption(post.caption);

          return (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Beitrag auf Instagram ansehen"
              onMouseMove={isCenter ? spotlightMove : undefined}
              className="spotlight-card group absolute flex w-64 flex-col overflow-hidden rounded-3xl border-2 border-fcb-border bg-fcb-surface shadow-2xl transition-all duration-500 ease-in-out md:w-80"
              style={{
                transform: `translateX(${pos * 54}%) scale(${
                  isCenter ? 1 : isAdjacent ? 0.82 : 0.68
                }) rotateY(${pos * -9}deg)`,
                zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                opacity: isCenter ? 1 : isAdjacent ? 0.5 : 0,
                filter: isCenter ? "blur(0px)" : "blur(4px)",
                visibility: Math.abs(pos) > 1 ? "hidden" : "visible",
                pointerEvents: isCenter ? "auto" : "none",
              }}
            >
              {isCenter && <SpotlightOverlays />}

              {/* Bild-Zone (4:5) */}
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <Image
                  src={post.imageUrl}
                  alt={instagramBildAlt(post.timestamp)}
                  fill
                  sizes="(max-width: 768px) 256px, 320px"
                  className="object-cover"
                />
                {isCenter && <InstagramOverlay className="right-3 top-3" />}
              </div>

              {/* Text-Zone (abgetrennt, über dem Lichtkegel):
                  Datum → Überschrift → Fließtext mit erhaltenen Absätzen.
                  Liegt auf bg-fcb-surface (Card-Fläche), nicht über dem Bild
                  → semantische Tokens statt literal white/white/70. */}
              <div className="relative z-10 flex flex-1 flex-col gap-1.5 p-4">
                <p className="font-inter text-[0.7rem] uppercase tracking-wider text-fcb-accent">
                  {formatPostDate(post.timestamp)}
                </p>
                {heading && (
                  <p className="line-clamp-2 font-inter text-sm font-semibold text-fcb-text">
                    {heading}
                  </p>
                )}
                {body && (
                  <p className="line-clamp-4 whitespace-pre-line font-inter text-sm leading-relaxed text-fcb-muted">
                    {body}
                  </p>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Pfeil-Navigation (Touch-Target 48×48 px).
          bg-black/50 = dunkler Scrim über den Fotos – bleibt in beiden Themes
          dunkel (das Bild dahinter ist immer dunkel). Daher text-white,
          border-white/20 und bg-black/50 bewusst als Literal – kein Token nötig. */}
      <button
        type="button"
        onClick={prev}
        aria-label="Vorheriger Beitrag"
        className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-fcb-accent sm:left-6"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Nächster Beitrag"
        className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-fcb-accent sm:right-6"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
