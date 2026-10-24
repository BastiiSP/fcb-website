"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { InstaPost } from "@/lib/beholdFeed";
import InstagramCarousel from "./InstagramCarousel";
import ButtonLink from "@/components/ui/ButtonLink";
import { useTenant } from "@/components/tenant/TenantProvider";

/**
 * „Vereins-News"-Sektion der Startseite: das finale Instagram-Carousel.
 *
 * Der interaktive Startseiten-Client lädt den Feed weiterhin clientseitig vom gemeinsamen
 * Endpoint /api/instagram – der ist serverseitig 1 h gecacht und schont so das
 * Behold-Free-Tier-Kontingent. Kurzer Ladezustand, dann das Carousel.
 */
export default function InstagramSection() {
  const config = useTenant();
  // null = lädt noch, [] = geladen aber leer, [...] = Posts
  const [posts, setPosts] = useState<InstaPost[] | null>(null);

  // Der FCB behält seine bisherige Betextung; die JFG spricht als eigener
  // Auftritt gezielt die JFG Kunstadt-Obermain an.
  const eyebrow =
    config.id === "fcb"
      ? "Aus dem Vereinsleben"
      : `Aus der ${config.name}`;
  const title = config.id === "fcb" ? "Vereins-News" : "JFG-News";

  useEffect(() => {
    let active = true;
    fetch("/api/instagram")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: InstaPost[]) => {
        if (active) setPosts(data);
      })
      .catch(() => {
        if (active) setPosts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="bg-fcb-bg px-4 py-12 md:py-16">
      <header className="mx-auto mb-10 max-w-5xl text-center">
        <p className="font-oswald text-xs font-bold uppercase tracking-[0.3em] text-fcb-accent">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-oswald text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          {title}
        </h2>
      </header>

      {posts === null ? (
        // Ladezustand – reserviert ungefähr die Carousel-Höhe gegen Layout-Shift.
        <div className="flex h-[420px] items-center justify-center md:h-[480px]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fcb-border border-t-fcb-accent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-fcb-border bg-fcb-surface px-6 py-12 text-center">
          <ImageOff size={28} className="text-fcb-muted" />
          <p className="text-sm text-fcb-muted">
            Aktuell konnten keine Instagram-Beiträge geladen werden.
          </p>
        </div>
      ) : (
        <>
          <InstagramCarousel posts={posts} />
          {/* Brücke zur ausführlichen News-Seite (Volltext + alle Bilder) */}
          <div className="mt-10 text-center">
            <ButtonLink href="/news" variant="secondary" size="md">
              Alle News ansehen
            </ButtonLink>
          </div>
        </>
      )}
    </section>
  );
}
