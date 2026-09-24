import type { NextConfig } from "next";
import path from "path";

// ✅ Konfiguration für Next.js 16
const nextConfig: NextConfig = {
  // Turbopack-Root explizit setzen, da Next.js 16 sonst durch das package-lock.json
  // im Home-Verzeichnis das falsche Workspace-Root erkennt
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      // Bestehende erlaubte Bildquellen
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "img.olympics.com",
      },
      {
        protocol: "https",
        hostname: "contents.mediadecathlon.com",
      },

      // ✅ Dynamische Instagram-Quellen (alle Subdomains via Wildcards)
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.fna.fbcdn.net",
        pathname: "/**",
      },

      // ✅ Behold.so – stabile, gehostete Bild-URLs des Instagram-Feeds
      // (behold.pictures + cdn2.behold.pictures). Wird von den
      // Instagram-Carousel-Varianten unter /instagram/* genutzt.
      {
        protocol: "https",
        hostname: "**.behold.pictures",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "behold.pictures",
        pathname: "/**",
      }
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS explizit statt nur über den Vercel-Plattform-Default (Audit 2026-09-24).
          // Bewusst ohne "preload": Aufnahme in die Browser-Preload-Liste ist kaum
          // rückgängig zu machen und wäre eine eigene Entscheidung für beide Domains.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  // Alte Routennamen (/kalender, /vorstand) dauerhaft auf die neuen, konsistenten
  // Routen umleiten – schützt bestehende Bookmarks/geteilte Links (z. B. bei Trainern).
  async redirects() {
    return [
      {
        source: "/kalender",
        destination: "/platzbuchung",
        permanent: true,
      },
      {
        source: "/vorstand",
        destination: "/vorstandsbereich",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
