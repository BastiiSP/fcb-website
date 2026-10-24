"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import CookieBanner from "@/components/consent/CookieBanner";

// Auth-Seiten sind immersive Vollbild-Erlebnisse (Pitch-Look): kein globaler
// Header/Footer, kein main-Padding. Consent bleibt aktiv (DSGVO gilt überall).
const AUTH_ROUTES = ["/login", "/registrieren", "/confirm-email", "/auth/callback", "/passwort-vergessen", "/passwort-neu"];

export default function ConditionalChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );

  if (isAuthRoute) {
    return (
      <ConsentProvider>
        {children}
        <CookieBanner />
      </ConsentProvider>
    );
  }

  return (
    <ConsentProvider>
      <Header />
      <main className="pt-14">{children}</main>
      <Footer />
      <CookieBanner />
    </ConsentProvider>
  );
}
