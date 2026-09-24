// Tenant-Erkennung für den Multi-Tenant-Betrieb (FCB + JFG aus einer Codebasis).
//
// Aufgabe: aus dem Hostnamen der Anfrage die Marke bestimmen und als
// Request-Header `x-tenant` weitergeben. Server Components lesen ihn über
// src/lib/tenant.server.ts, das Root-Layout setzt daraus `data-tenant` auf
// <html> (steuert die Akzentfarbe, analog zu .dark/.light).
//
// Dateiname/-ort sind nicht frei wählbar: Next.js 16 hat die alte
// `middleware`-Konvention durch `proxy` ersetzt (Deprecation-Warnung beim
// Build), und die Datei muss auf der Konventionsebene liegen – hier `src/`,
// weil die App unter `src/app` liegt. Ein `middleware.ts` im Repo-Root wird
// in diesem Setup stillschweigend IGNORIERT (verifiziert: kein Set-Cookie,
// kein x-tenant-Header). Nicht verschieben, nicht umbenennen.
//
// Test-Mechanismus ohne echte Domain (die JFG-Domain ist noch nicht
// registriert): `?tenant=jfg` an eine beliebige URL hängen. Der Wert wird in
// einem Cookie festgehalten, damit die anschließende Navigation im JFG-Auftritt
// bleibt; `?tenant=fcb` schaltet zurück. Auf echten Produktionsdomains wird der
// Override bewusst IGNORIERT – dort entscheidet allein der Hostname, damit ein
// altes Cookie den Live-Auftritt niemals umfärben kann.
//
// Der Hostname-Abgleich läuft ausschließlich exakt gegen die bekannten
// Produktionsdomains (siehe tenantAusHostname) – Preview-Hosts sind deshalb
// immer FCB, unabhängig davon, wie der Branch heißt.

import { NextResponse, type NextRequest } from "next/server";
import {
  TENANT_COOKIE,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  istProduktionsHost,
  istTenantId,
  tenantAusHostname,
} from "@/lib/tenant";

const CSP_HEADER = "Content-Security-Policy";

function erstelleContentSecurityPolicy(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseOrigin: string | null = null;
  let supabaseWebSocketOrigin: string | null = null;

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      supabaseOrigin = url.origin;
      supabaseWebSocketOrigin = `wss://${url.host}`;
    } catch (error) {
      // Eine ungültige URL wird bewusst nicht freigegeben, damit die CSP sicher
      // geschlossen bleibt; die Diagnose gehört ausschließlich ins Server-Log.
      console.error("NEXT_PUBLIC_SUPABASE_URL ist für die CSP ungültig:", error);
    }
  }

  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
  ];
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ];
  const connectSources = [
    "'self'",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
    ...(supabaseWebSocketOrigin ? [supabaseWebSocketOrigin] : []),
    "https://vitals.vercel-insights.com",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ") + ";";
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

export function proxy(req: NextRequest) {
  // Host-Header statt nextUrl.hostname: auf Vercel trägt nur der Header die
  // tatsächlich aufgerufene Domain.
  const host = req.headers.get("host") ?? req.nextUrl.hostname;
  const vomHost = tenantAusHostname(host);

  const override = req.nextUrl.searchParams.get(TENANT_QUERY_PARAM);
  const cookie = req.cookies.get(TENANT_COOKIE)?.value;

  // Produktionsdomains: Hostname gewinnt immer.
  const overrideErlaubt = !istProduktionsHost(host);

  let tenant = vomHost;
  if (overrideErlaubt) {
    if (istTenantId(override)) tenant = override;
    else if (istTenantId(cookie)) tenant = cookie;
  }

  const headers = new Headers(req.headers);
  headers.set(TENANT_HEADER, tenant);

  // Next.js liest die CSP aus den Request-Headern und versieht damit seine
  // eigenen Scripts; der Response-Header erzwingt dieselbe Policy im Browser.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = erstelleContentSecurityPolicy(nonce);
  headers.set("x-nonce", nonce);
  headers.set(CSP_HEADER, contentSecurityPolicy);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set(CSP_HEADER, contentSecurityPolicy);

  // Override persistieren, damit Folgeklicks im gewählten Auftritt bleiben.
  if (overrideErlaubt && istTenantId(override)) {
    res.cookies.set(TENANT_COOKIE, override, {
      path: "/",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return res;
}

export const config = {
  // Statische Assets und Bild-Optimierung ausnehmen – dort ist der Tenant
  // irrelevant und der Proxy nur Overhead.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
