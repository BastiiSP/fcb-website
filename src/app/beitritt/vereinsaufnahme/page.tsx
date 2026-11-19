import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Beitrittsformular from "@/components/beitritt/Beitrittsformular";
import PageShell from "@/components/ui/PageShell";
import { getTenant } from "@/lib/tenant.server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTenant()) === "jfg" ? "Beitrittserklärung" : "Seite nicht gefunden",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function Beitrittsseite() {
  if ((await getTenant()) !== "jfg") notFound();

  return (
    <PageShell maxWidth="xl">
      <Beitrittsformular />
    </PageShell>
  );
}
