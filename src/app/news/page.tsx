import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import ButtonLink from "@/components/ui/ButtonLink";
import NewsPostCard from "@/components/news/NewsPostCard";
import { getInstagramPosts } from "@/lib/beholdFeed";
import { getTenantConfigServer } from "@/lib/tenant.server";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getTenantConfigServer();

  return {
    title: "News",
    alternates: { canonical: "/news" },
    description: `Neuigkeiten ${config.nameVonDativ}: Spielberichte, Termine und Bilder direkt aus unserem Instagram-Kanal.`,
  };
}

// News-Seite = prominente Instagram-Ansicht. Bewusst KEIN eigenes CMS:
// Der Verein pflegt Inhalte nur auf Instagram, die Seite zieht sie automatisch
// über den Behold-Feed (1-h-Cache in getInstagramPosts → ISR, Free-Tier-schonend).

export default async function NewsPage() {
  const config = await getTenantConfigServer();
  const posts = await getInstagramPosts(config.id);

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        title="News"
        subtitle={`Was ${config.kurznameDativ} los ist: unsere Instagram-Beiträge, automatisch aktuell.`}
      />

      {posts.length === 0 ? (
        // Leerer Feed (z. B. Feed nicht erreichbar): freundlicher Hinweis statt Fehlerseite
        <div className="rounded-2xl border border-fcb-border bg-fcb-surface p-8 text-center">
          <p className="font-inter text-base text-fcb-text/80">
            Gerade können wir hier keine Beiträge laden. Schau am besten direkt
            auf unserem Instagram-Kanal vorbei, da ist immer was los.
          </p>
          <div className="mt-5 flex justify-center">
            <ButtonLink href={config.instagramUrl} external variant="primary">
              Zu unserem Instagram
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {posts.map((post) => (
              <NewsPostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Abschluss: mehr gibt es auf Instagram */}
          <div className="mt-12 text-center">
            <p className="font-inter text-sm text-fcb-muted">
              Noch mehr Bilder und Stories gibt es auf unserem Kanal.
            </p>
            <div className="mt-4 flex justify-center">
              <ButtonLink
                href={config.instagramUrl}
                external
                variant="secondary"
              >
                {config.instagramHandle} auf Instagram
              </ButtonLink>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
