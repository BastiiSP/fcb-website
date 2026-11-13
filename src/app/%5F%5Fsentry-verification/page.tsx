import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import VerificationButtons from "./verification-buttons";

export const dynamic = "force-dynamic";

export default function SentryVerificationPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  return (
    <PageShell maxWidth="lg" className="pt-24">
      <Card>
        <h1 className="font-oswald text-3xl font-bold uppercase text-fcb-text">
          Sentry Laufzeitprüfung
        </h1>
        <p className="mt-3 font-inter text-fcb-muted">
          Jeder Knopf löst einmalig einen kontrollierten Testfehler aus.
        </p>
        <VerificationButtons />
      </Card>
    </PageShell>
  );
}
