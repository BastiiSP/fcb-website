import type { Metadata } from "next";
import { headers } from "next/headers";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

// ConditionalChrome rendert Header/Footer + main-Padding um alle Routen.
// (Die früheren Design-Exploration-Routen wurden nach Runde 2 entfernt.)
import ConditionalChrome from "@/components/ConditionalChrome";
import { TenantProvider } from "@/components/tenant/TenantProvider";
import { getTenantConfigServer } from "@/lib/tenant.server";

// Marken-Schriften (Oswald = Headlines, Inter = Body) als CSS-Variablen.
// Werden in modernen Komponenten via font-oswald / font-inter genutzt.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Titel/Beschreibung hängen an der aufgerufenen Marke – deshalb dynamisch
// statt statischem metadata-Export.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfigServer();
  return {
    title: tenant.metaTitle,
    description: tenant.metaDescription,
    // Icons pro Marke: vorher stand hier fest "/favicon.ico" (FCB-Wappen),
    // wodurch der JFG-Browsertab das falsche Wappen zeigte. `shortcut` ist
    // bewusst mit gesetzt – ältere Browser lesen nur rel="shortcut icon" und
    // hätten sonst weiter blind /favicon.ico geholt.
    icons: {
      icon: tenant.faviconSrc,
      shortcut: tenant.faviconSrc,
      apple: tenant.appleTouchIconSrc,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Marke der laufenden Anfrage (src/proxy.ts → x-tenant-Header).
  const tenant = await getTenantConfigServer();
  const nonce = (await headers()).get("x-nonce");

  return (
    // data-tenant steuert die Akzentfarbe (--color-accent in globals.css),
    // genau wie .dark/.light das Theme steuern.
    <html lang="de" data-tenant={tenant.id} suppressHydrationWarning>
      <head>
        {/* FOUC-Schutz: setzt das Theme VOR dem ersten Paint aus localStorage,
            Fallback dunkel. Inline + blockierend, daher kein Aufblitzen. */}
        {/* suppressHydrationWarning: Browser verbergen das nonce-Attribut nach dem
            Parsen (DOM zeigt nonce=""), React meldet sonst einen falschen Mismatch. */}
        <script
          nonce={nonce ?? undefined}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body
        // Oswald & Inter werden als CSS-Variablen verfügbar gemacht und in
        // modernen Komponenten via font-oswald / font-inter (Tailwind) genutzt.
        // bg/color kommen jetzt aus globals.css (body-Regel mit semantischen Tokens).
        className={`${oswald.variable} ${inter.variable} antialiased`}
      >
        {/* TenantProvider gibt die Marken-Konfiguration an die Client
            Components weiter (Header, Vereins-Switcher, Footer). */}
        <TenantProvider config={tenant}>
          {/* ConditionalChrome rendert Header/Footer und das Main-Padding. */}
          <ConditionalChrome>{children}</ConditionalChrome>
        </TenantProvider>

        {/* Vercel Monitoring */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
