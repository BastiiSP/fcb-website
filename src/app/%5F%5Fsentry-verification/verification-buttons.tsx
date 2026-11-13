"use client";

import { useRef, useState } from "react";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";

type ServerStatus = "bereit" | "laeuft" | "erwartet" | "unerwartet";

export default function VerificationButtons() {
  const clientGestartet = useRef(false);
  const serverGestartet = useRef(false);
  const [clientAusgeloest, setClientAusgeloest] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("bereit");

  function clientFehlerAusloesen() {
    if (clientGestartet.current) return;
    clientGestartet.current = true;
    setClientAusgeloest(true);
    setTimeout(() => {
      throw new Error("FCB_SENTRY_TEST_CLIENT");
    }, 0);
  }

  async function serverFehlerAusloesen() {
    if (serverGestartet.current) return;
    serverGestartet.current = true;
    setServerStatus("laeuft");
    try {
      const response = await fetch("/api/__sentry-verification", {
        method: "POST",
        cache: "no-store",
      });
      setServerStatus(response.status === 500 ? "erwartet" : "unerwartet");
    } catch {
      setServerStatus("unerwartet");
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={clientFehlerAusloesen} disabled={clientAusgeloest}>
          Clientfehler auslösen
        </Button>
        <Button variant="secondary" onClick={serverFehlerAusloesen} disabled={serverStatus !== "bereit"}>
          Serverfehler auslösen
        </Button>
      </div>
      {clientAusgeloest && (
        <Banner variant="info" message="Clientfehler ausgelöst. Den Eingang in Sentry prüfen." />
      )}
      {serverStatus === "laeuft" && (
        <Banner variant="info" message="Serveranfrage läuft." />
      )}
      {serverStatus === "erwartet" && (
        <Banner variant="info" message="Serverantwort 500 ist für diesen Test erwartet. Den Eingang in Sentry prüfen." />
      )}
      {serverStatus === "unerwartet" && (
        <Banner variant="error" message="Keine erwartete Serverantwort erhalten. Den Testzugang und die Anfrage prüfen." />
      )}
    </div>
  );
}
