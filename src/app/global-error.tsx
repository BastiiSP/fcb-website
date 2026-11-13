"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";
import { DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme } from "@/lib/theme";
import { TENANT_COOKIE, istProduktionsHost, istTenantId, tenantAusHostname } from "@/lib/tenant";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
    const host = window.location.hostname;
    const cookie = document.cookie.split("; ").find((part) => part.startsWith(`${TENANT_COOKIE}=`))?.split("=")[1];
    const override = new URLSearchParams(window.location.search).get("tenant");
    const tenant = !istProduktionsHost(host) && istTenantId(override) ? override
      : !istProduktionsHost(host) && istTenantId(cookie) ? cookie : tenantAusHostname(host);
    document.documentElement.dataset.tenant = tenant;
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      applyTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : DEFAULT_THEME);
    } catch {
      document.documentElement.classList.add(DEFAULT_THEME);
    }
  }, [error]);

  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <body className="bg-fcb-bg font-inter text-fcb-text">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="font-oswald text-3xl font-bold uppercase">Ein Fehler ist aufgetreten</h1>
          <p>Die Seite konnte nicht angezeigt werden. Bitte versuche es erneut.</p>
          <button type="button" onClick={reset} className="w-fit rounded-lg bg-fcb-accent px-4 py-2 font-oswald font-semibold uppercase text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fcb-accent">
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  );
}
