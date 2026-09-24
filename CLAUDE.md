# FCB Website – Claude Code Kontext

## Projekt

Website des 1. FC 1911 Burgkunstadt – ein echter Fußballverein aus Burgkunstadt.

- **Live-URL**: https://www.fcbuku.de
- **GitHub**: https://github.com/BastiiSP/fcb-website
- **Deployment**: Vercel (auto-deploy bei Push auf `main`)
- **Supabase Project Ref**: jktvmckqfklfziszfsxf
- **Lokaler Pfad**: `~/Workspace/fcb-website/`

## Multi-Tenant (FCB + JFG) – eine Codebasis, zwei Auftritte

- **Domains**: `www.fcbuku.de` (FCB) · `www.jfg-kunstadt-obermain.de` (JFG, live seit 2026-07-29)
- **Erkennung**: `src/proxy.ts` (Next-16-Nachfolger von `middleware` – NICHT verschieben/umbenennen,
  ein `middleware.ts` wird still ignoriert) setzt den Header `x-tenant`; das Root-Layout setzt daraus
  `data-tenant` auf `<html>` → steuert das Token `fcb-accent` (FCB blau / JFG rot).
- **Einzige Quelle für Markenwerte** (Name, Logo, Nav, Domain, Feed): `src/lib/tenant.ts`
  (framework-neutral, Config muss serialisierbar bleiben). Server: `getTenant()` aus
  `lib/tenant.server.ts` (macht die Route dynamisch – gewollt). Client: `components/tenant/TenantProvider.tsx`.
  Markentexte: `lib/vereinstexte.ts` (redaktionell), `lib/rechtstexte.ts` (Impressum/Datenschutz).
- **Test ohne Domain**: `?tenant=jfg` / `?tenant=fcb` an die URL (Cookie `fcb-tenant`). Auf
  Produktionsdomains ignoriert; Preview-Hosts und localhost sind ohne Override immer FCB.
- **Regeln**: Keine Markennamen/Logos/Texte hart codieren. Markenexklusive Routen (z. B.
  `/sportheim`, nur FCB) per `notFound()` + `generateMetadata()` absichern. Bei UI-/Text-/
  Routing-Änderungen den Agent `multi-tenant-konsistenz-reviewer` nutzen; E2E-Tests über
  Skill `e2e-tenant-test-schreiben`.

## Tech Stack

- **Next.js 16** mit App Router
- **React 19** / **TypeScript 5** (strict mode)
- **Tailwind CSS 3** (v3.4 – NICHT v4: Tokens in `tailwind.config.ts`, keine `@theme`-CSS-Directive)
- **Framer Motion 12** (alle Animationen)
- **Supabase** (PostgreSQL + Auth + RLS)
- **FullCalendar 6** (Buchungskalender)
- **Vercel** (Hosting + Analytics)
- **UI-Libs**: `@headlessui/react`, `lucide-react` (Icons), `react-select`, `react-datepicker`, `react-easy-crop`, `@tippyjs/react`, `date-fns`. Brand-/Social-Icons via `src/components/icons/BrandIcons.tsx` (Lucide hat keine). `react-icons` ist Altlast – nicht für Neues nutzen.

## Rollenkonzept – KRITISCH

Niemals ohne Rücksprache ändern. Das Rollensystem ist das Herzstück der Zugangskontrolle.

| Rolle | Wer | Rechte |
|---|---|---|
| `ausstehend` | Jeder nach Selbstregistrierung | Nur Profil-Seite – wartet auf Freigabe durch Vorstand |
| `mitglied` | Vereinsmitglieder mit Login | Mein-Verein-Seite + Profil; kein Kalender-Zugriff |
| `trainer` | Trainer, Platzwarte, Betreuer | Platzbuchungen anlegen & eigene verwalten |
| `vorstand` | Vorstandsmitglieder | Alles + alle Buchungen verwalten + Nutzer freischalten |
| `admin` | IT-Verantwortlicher | Alles + Vorstandsrollen und Admin-Rollen vergeben |

**Wichtig:** Vorstand darf zwischen `ausstehend` / `mitglied` / `trainer` wechseln. Nur `admin` darf `vorstand` und `admin` vergeben.
Das erzwingt zusätzlich die DB: Trigger `trg_prevent_role_escalation` (nur admin vergibt
vorstand/admin) und `trg_prevent_self_role_change` auf `profiles` – beide live. Rollen-Labels:
`src/lib/rollen.ts`. Privilegierte API-Routen (z. B. `api/benutzer-ablehnen`) prüfen Access-Token
+ Rolle des Aufrufers serverseitig. Vor Änderungen an RLS/Rollenlogik: Skill
`rls-rollenkonzept-check` und Agent `rls-rollen-reviewer`.

## Datenbankschema (Phase 1 – aktiv)

### Tabelle: `profiles`

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | FK → auth.users, Primary Key |
| `vorname` | TEXT | NOT NULL |
| `nachname` | TEXT | NOT NULL |
| `telefonnummer` | TEXT | optional |
| `rolle` | TEXT | DEFAULT 'ausstehend', CHECK (ausstehend/mitglied/trainer/vorstand/admin) |
| `mannschaft` | TEXT[] | Mehrfachauswahl möglich |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto via Trigger |
| `geburtsdatum` | DATE | optional |
| `strasse` | TEXT | optional |
| `plz` | TEXT | optional |
| `ort` | TEXT | optional |
| `trainer_lizenzen` | TEXT[] | optional, Mehrfachauswahl möglich |
| `avatar_url` | TEXT | optional, öffentliche Supabase-Storage-URL |

### Tabelle: `buchungen`

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid() |
| `platz` | TEXT | CHECK: hauptplatz / nebenplatz |
| `platzanteil` | TEXT | CHECK: viertel / halb / ganz |
| `anlass` | TEXT | CHECK: training / freundschaftsspiel / punktspiel / platzpflege |
| `startzeit` | TIMESTAMPTZ | NOT NULL |
| `endzeit` | TIMESTAMPTZ | NOT NULL |
| `mannschaft` | TEXT | NOT NULL |
| `buchende_person` | TEXT | NOT NULL |
| `bemerkung` | TEXT | optional |
| `user_id` | UUID | FK → auth.users, ON DELETE SET NULL |
| `serien_id` | UUID | optional – gemeinsame ID aller Termine einer Serienbuchung (`lib/serienbuchung.ts`) |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto via Trigger |

Optionslisten/Labels der CHECK-Felder: `src/lib/buchungsOptionen.ts` (single source of truth).

### Tabelle: `sportheim_anfragen` (FCB)

Öffentliche Sportheim-Anfragen + interne Sperrtermine in einer Zeitquelle.
`typ`: anfrage / sperrung · `status`: offen / angenommen / abgelehnt. CHECKs erzwingen
Pflicht-Kontaktdaten bei `anfrage` und leere Personendaten + `angenommen` bei `sperrung`.
RLS: anon + authenticated dürfen nur INSERTen mit `typ='anfrage'`, `status='offen'`,
`erstellt_von IS NULL`; Lesen/Ändern/Löschen/Sperrungen nur vorstand/admin. Die öffentliche Belegung liefert die Funktion `sportheim_belegte_zeiten()` (ohne
Personendaten). Details: `supabase/migrations/20260707120000_create_sportheim_anfragen.sql`.

### Storage & Migrationen

- Bucket `avatars` – Profilbilder, öffentliche URL landet in `profiles.avatar_url`.
- Migrationen liegen versioniert in `supabase/migrations/` – neue Migration dort ablegen UND per
  MCP anwenden (danach live prüfen, nicht nur committen).

### Tabelle: `mitglieder` (Phase 2 – aktiv)

Vereinsmitglieder ohne Login-Konto. Wird von Vorstand/Admin gepflegt.

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid(), Primary Key |
| `mitgliedsnummer` | INTEGER | GENERATED ALWAYS AS IDENTITY – automatisch, kein Input-Feld |
| `vorname`, `nachname` | TEXT | NOT NULL |
| `email`, `telefonnummer` | TEXT | optional |
| `geburtsdatum`, `eintrittsdatum` | DATE | optional |
| `status` | TEXT | CHECK (aktiv/passiv/ehrenamt/gekündigt), DEFAULT 'aktiv' |
| `mannschaft` | TEXT[] | optional |
| `notizen` | TEXT | optional |
| `erstellt_von` | UUID | FK → auth.users, SET NULL bei Löschung |
| `created_at`, `updated_at` | TIMESTAMPTZ | auto, updated_at via Trigger |

RLS: SELECT/INSERT/UPDATE/DELETE nur für vorstand und admin. Trainer: kein Zugriff.

### Tabelle: `mannschaftsanfragen`

Anfragen von `mitglied`-Nutzern zum Beitritt/Austritt aus einer Mannschaft. Wird von Vorstand/Admin im Vorstandsbereich verwaltet.

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid(), Primary Key |
| `user_id` | UUID | FK → auth.users |
| `typ` | TEXT | Art der Anfrage (z. B. beitritt / austritt) |
| `mannschaft` | TEXT | Betroffene Mannschaft |
| `begruendung` | TEXT | optional |
| `status` | TEXT | DEFAULT 'offen'; weitere Werte: genehmigt / abgelehnt |
| `created_at` | TIMESTAMPTZ | auto |

RLS: Nutzer sehen/erstellen nur eigene Anfragen; vorstand und admin verwalten alle.

### Tabelle: `keepalive` (technisch)

Verhindert das Pausieren des Supabase-Free-Tiers: Der GitHub-Actions-Workflow
`.github/workflows/supabase-keepalive.yml` schreibt alle 3 Tage per anon-INSERT einen
Eintrag (RLS-Policy erlaubt anon nur INSERT). Kein Fach-Schema – nicht umbauen, nicht in
Features verwenden. Hintergrund: anon-Leseanfragen zählt Supabase nicht zuverlässig als
Aktivität, deshalb Write statt Read.

## Code-Regeln

- **Tabellenname**: `profiles` (Plural) – niemals `profile` (Singular, das war der alte kaputte Name)
- **Spaltenname**: `rolle` (Singular, String) – niemals `rollen` (Plural/Array, das war der alte kaputte Name)
- **TypeScript strict**: Keine `any` Types. Immer explizite Interfaces definieren.
- **RLS immer aktiv**: Zugangskontrolle läuft in der Datenbank, nicht nur im Frontend
- **GRANTs nicht vergessen**: Bei jeder neuen Tabelle explizit `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabelle> TO authenticated;` ausführen – ohne das greift RLS nie, da Postgres vorher mit „permission denied" abbricht. Bereits zweimal vergessen: `buchungen` (2026-05-22) und `mitglieder` (2026-05-26).
- **Neue Tabelle anlegen**: Immer das Skill `supabase-tabelle-anlegen` nutzen (`.claude/skills/`) – verifiziertes Rezept mit korrekter Trigger-Funktion (`handle_updated_at()`), RLS-Muster (`get_own_rolle()`), GRANT und Workflow-Checkliste.
- **Komponente bauen/ändern**: Immer das Skill `fcb-komponente-bauen` nutzen (`.claude/skills/`) – verifizierte Werte für Tokens (Dual-Theme!), Fonts, Icons, Framer Motion, A11y und die `ui/`-Primitive.
- **Supabase MCP nutzen**: Für alle Datenbankoperationen den MCP-Server verwenden
- **Keine direkten DB-Calls ohne RLS-Check** in Server Components
- **Fehlerbehandlung**: Alle Supabase-Calls mit try/catch und aussagekräftigen Fehlermeldungen
- **Deutsch**: Alle UI-Texte, Fehlermeldungen und Kommentare auf Deutsch
- **Codekommentare**: Neuen und geänderten Code sinnvoll kommentieren – nicht jede Zeile, aber überall dort, wo der Zusammenhang nicht sofort klar ist. Kommentare erklären das *Warum* oder den *Kontext*, nicht das *Was* (das liest man am Code selbst). Beispiele wo kommentiert wird: komplexe Logik, nicht-offensichtliche Bedingungen, RLS-relevante Stellen, Supabase-spezifisches Verhalten, Workarounds oder bewusste Entscheidungen.

## Wichtige Dateipfade

```
src/
├── app/
│   ├── page.tsx                   ← Homepage (Hero, Instagram-Sektion, Brücke zur News-Seite)
│   ├── verein/page.tsx            ← Öffentliche Vereinsseite
│   ├── mannschaften/page.tsx      ← Teams (TeamCards) + BFV-Spielbetrieb (Tabelle & Spiele)
│   ├── news/page.tsx              ← News-Seite (Instagram-only, kein CMS)
│   ├── kontakt/page.tsx           ← Öffentliche Kontaktseite
│   ├── platzbuchung/page.tsx      ← Buchungskalender (nur trainer/vorstand/admin), Redirect von /kalender
│   ├── meine-buchungen/page.tsx   ← Eigene Platzbuchungen (alle Eingeloggten, Sichtbarkeit per RLS)
│   ├── sportheim/page.tsx         ← Sportheim: Belegungskalender + öffentliche Anfrage (NUR FCB, JFG → 404)
│   ├── vorstandsbereich/page.tsx  ← Vorstandsbereich inkl. Buchungs- und Sportheim-Anfragen (nur vorstand/admin), Redirect von /vorstand
│   ├── mitglieder/page.tsx        ← Trainer-Verzeichnis (Rolle trainer) / Mitgliederverwaltung (vorstand/admin) – einheitliche H1 „Mitglieder" seit 2026-07-10, rollenspezifischer Untertitel
│   ├── mein-verein/page.tsx       ← Vereinslinks & Info (mitglied + höher)
│   ├── profil/page.tsx            ← Profilverwaltung (alle eingeloggten Rollen)
│   ├── login/ · registrieren/ · confirm-email/  ← Auth-Seiten (Pitch-Look)
│   ├── auth/callback/page.tsx     ← OAuth-Redirect (Google-Login)
│   ├── impressum/ · datenschutz/  ← Rechtstexte (RechtstextLayout)
│   └── api/
│       ├── spielbetrieb/route.ts  ← Debug-Endpoint für BFV-Daten (?team=herren-1)
│       ├── instagram/route.ts     ← Instagram-Feed (Behold)
│       ├── keep-alive/route.ts    ← Supabase-Ping (Haupt-Keepalive läuft als GitHub Action, s. Tabelle keepalive)
│       └── benutzer-ablehnen/route.ts  ← Account löschen (prüft Token + vorstand/admin serverseitig)
├── proxy.ts                       ← Tenant-Erkennung (x-tenant), s. „Multi-Tenant"
├── components/
│   ├── Header.tsx                 ← Smart-Sticky-Nav, kanonisches Design-Vorbild
│   (Navigation.tsx entfernt seit 2026-07-07 – Nav-Links leben in UserDropdown.tsx, Konstante ALLE_LINKS, seit 2026-07-10 rollenunabhängig für alle eingeloggten Nutzer sichtbar)
│   ├── Footer.tsx                 ← Dreispaltig, enthält den Theme-Umschalter
│   ├── ConditionalChrome.tsx      ← Blendet Header/Footer auf Auth-Routen aus
│   ├── UserDropdown.tsx           ← Nutzer-Menü in der Nav
│   ├── VereinsSwitcher.tsx        ← Wechsel zwischen FCB- und JFG-Domain im Header
│   ├── Buchungsformular.tsx / BearbeitenModal.tsx / LoeschenModal.tsx
│   ├── MeineBuchungen.tsx         ← Liste für /meine-buchungen
│   ├── SportheimAnfragenVerwaltung.tsx  ← Sportheim-Anfragen + Sperrtermine im Vorstandsbereich
│   ├── BuchungenVerwaltung.tsx    ← Buchungsübersicht im Vorstand-Bereich (Filter, Pagination, Mobile-Cards)
│   ├── BenutzerListe.tsx          ← Nutzerverwaltung + Mannschaftsanfragen im Vorstand-Bereich
│   ├── MannschaftsanfragenVerwaltung.tsx
│   ├── MitgliederVerwaltung.tsx / MitgliedBearbeitenModal.tsx   ← Mitgliederverwaltung (Phase 2)
│   ├── TrainerVerzeichnis.tsx / TooltipContent.tsx
│   ├── ToastMessage.tsx           ← Globale Erfolgs-/Fehlermeldungen
│   ├── ui/                        ← Design-System-Primitive: Button, ButtonLink, buttonStyles,
│   │                                Card, Banner, Badge, IconBadge, TeamCard, Modal, PageShell,
│   │                                PageHeader, Tabs, Select, TextField, Textarea, ThemeToggle,
│   │                                ZugriffsHinweis, reactSelectTheme
│   ├── tenant/TenantProvider.tsx  ← Tenant-Config für Client Components
│   ├── kalender/                  ← FullCalendar-Bausteine (EventChip, KalenderToolbar)
│   ├── sportheim/                 ← SportheimBereich, SportheimKalender, SportheimAnfrageFormular
│   ├── icons/BrandIcons.tsx       ← Facebook/Instagram/WhatsApp/Google als Inline-SVG (Lucide hat keine Brand-Icons)
│   ├── spielbetrieb/              ← BFV-UI: SpielbetriebSection, SpielbetriebExplorer (Verein → Mannschaft), SpielbetriebCard
│   ├── news/NewsPostCard.tsx      ← Instagram-Post-Card der News-Seite
│   ├── instagram/                 ← InstagramSection / InstagramCarousel (Homepage)
│   ├── consent/                   ← DSGVO: ConsentProvider, CookieBanner, ConsentGate
│   │                                (ConsentGate bewusst ohne Konsumenten: Instagram läuft über
│   │                                den next/image-Proxy, BFV server-side – beides first-party;
│   │                                erst bei echten Client-Einbettungen nutzen)
│   ├── rechtstexte/RechtstextLayout.tsx
│   ├── hero/                      ← Homepage-Hero (HybridPitch, HybridCanvas, RotatingText)
│   ├── auth/                      ← Auth-UI (Pitch-Look: Shell, Background, Felder, Google-Button)
│   └── profil/                    ← Profil-Unterkomponenten (PersoenlicheDaten, AccountSicherheit,
│                                    AvatarUploadModal, MannschaftLizenzen, MannschaftsAnfrageModal)
├── hooks/
│   └── useTheme.ts                ← Theme lesen/umschalten (localStorage + .dark/.light auf <html>)
├── lib/
│   ├── supabaseClient.ts          ← Supabase-Singleton (anon key); Exporte: `supabase` + `createClient()`
│   ├── tenant.ts / tenant.server.ts  ← Markenkonfiguration FCB/JFG (s. „Multi-Tenant")
│   ├── vereinstexte.ts / rechtstexte.ts  ← Markentexte (/verein, /kontakt) bzw. Impressum/Datenschutz je Marke
│   ├── rollen.ts                  ← ROLLEN_LABELS (deutsche Rollen-Anzeigenamen)
│   ├── buchungsOptionen.ts        ← Optionen + Labels der buchungen-CHECK-Felder
│   ├── serienbuchung.ts           ← Serienbuchungen anlegen/bearbeiten (serien_id)
│   ├── sportheim.ts / sportheimAnfragenTypes.ts  ← Sportheim-Inhalte (Preise = PLATZHALTER) + Typen
│   ├── teams.ts                   ← Team-Daten + getTeamAccent() (FCB/JFG-Akzent-Klassen)
│   ├── mannschaften.ts            ← Mannschaftsliste für Formulare (Konstanten)
│   ├── bfv.ts                     ← BFV-Widget-API: BFV_TEAMS-Konfiguration + getSpielbetrieb()
│   ├── bfvTypes.ts                ← Typen für BFV-Tabelle & Spiele
│   ├── beholdFeed.ts              ← Instagram-Feed via Behold (Parsing, Caption-Split, Datum)
│   ├── consent.ts                 ← Consent-Kategorien & localStorage-Handling
│   ├── theme.ts                   ← Theme-Konstanten + applyTheme() (Default: dark)
│   ├── lizenzen.ts                ← Lizenz-Daten
│   ├── vereinslinks.ts            ← Externe Vereinslinks (WhatsApp, Social Media etc.)
│   └── auth/signInWithGoogle.ts   ← Google-OAuth-Start
└── utils/
    ├── checkSession.ts            ← Session + Rolle prüfen
    ├── fetchEvents.ts             ← Buchungen laden
    ├── getEventColor.ts           ← Kalender-Farben nach Mannschaft
    ├── formatKalenderTitel.ts     ← Buchungstitel formatieren
    ├── formatCapitalized.ts       ← Hilfsfunktion Großschreibung
    └── passwortStaerke.ts         ← Passwort-Stärke-Berechnung
```

Außerhalb von `src/`: `e2e/smoke.spec.ts` (Playwright-Smoke-Suite),
`supabase/migrations/` (versionierte Migrationen) und
`.github/workflows/supabase-keepalive.yml` (Keepalive-Cron, s. Tabelle `keepalive`).
Claude-Automatisierungen: `.claude/skills/` (Projekt-Skills) und `.claude/agents/`
(`rls-rollen-reviewer`, `multi-tenant-konsistenz-reviewer`).

### Bild-Assets: `public/` vs. `assets-source/`

- **`public/`** – aktiv von der Website ausgelieferte, bereits optimierte Dateien (z. B.
  `logo-fc-redwitz.png`, `logo-sg-roth-main.png`, `logo-jfg.png`, `stadtwappen-burgkunstadt.svg`,
  je 512×512px). Wird direkt referenziert, hier landen nur einsatzbereite Web-Versionen.
- **`assets-source/`** – hochauflösende Original-/Quelldateien, die nicht direkt ausgeliefert
  werden (kein `public/`-Unterordner, taucht also nicht auf der Website auf). Dient als Backup/
  Rohmaterial, falls Logos später neu zugeschnitten oder in höherer Auflösung gebraucht werden.
  - `assets-source/wappen/` – Vereinswappen in Originalgröße (z. B. `fc-redwitz.png`,
    `sg-roth-main.png`, beide 1254×1254px), Gegenstücke zu den optimierten Logos in `public/`.

**Faustregel bei neuen Bild-Dateien für dieses Projekt:** Fertige, für die Website optimierte
Assets → `public/` (flach, sprechender Dateiname). Hochauflösende Rohdateien/Originale, die nur
als Quelle dienen → `assets-source/<kategorie>/`. Bei Unsicherheit, ob eine Datei schon als
Web-Version existiert: vorher `public/` auf ähnliche Dateinamen prüfen, um Dopplungen zu vermeiden.

## BFV-Spielbetrieb (Tabelle & Spiele)

Live-Sportdaten (Tabelle, Ergebnisse, Termine) der Herrenmannschaften kommen **ohne Login**
von der öffentlichen BFV-Widget-API (`https://widget-prod.bfv.de/api/service/widget/v1`) –
Quelle ist bfv.de, nicht fussball.de.

- **Konfiguration**: `BFV_TEAMS` in `src/lib/bfv.ts`. Pro Team wird nur die stabile
  `teamPermanentId` aus der öffentlichen BFV-Mannschafts-URL gepflegt – Liga, Staffel und
  `compoundId` liefert der Matches-Endpunkt automatisch. Schritt-für-Schritt-Anleitung zum
  Ergänzen weiterer Teams steht als Kommentar direkt über `BFV_TEAMS`.
- **Caching**: 1 Stunde (`REVALIDATE_SECONDS` / `revalidate = 3600`) – die BFV-Quelle nicht
  häufiger abfragen.
- **Debug**: `/api/spielbetrieb?team=herren-1` zeigt die Rohdaten pro Team (ohne Parameter:
  alle konfigurierten Teams), ohne die Seite rendern zu müssen.
- **UI**: `src/components/spielbetrieb/` – `SpielbetriebSection` auf `/mannschaften`,
  `SpielbetriebExplorer` (Auswahl Verein → Mannschaft), `SpielbetriebCard` (Tabelle + Spiele).

## Supabase MCP

Der Supabase MCP-Server ist eingerichtet. Nutze ihn für:
- Schema-Änderungen und Migrationen
- SQL ausführen
- Tabellen prüfen und debuggen
- Auth-Einstellungen

## Lokale Entwicklung

```bash
cd ~/Workspace/fcb-website
npm run dev        # Entwicklungsserver auf localhost:3000
npm run build      # Production Build – schlägt LOKAL oft fehl (s. Deployment), Vercel baut sauber
npm run lint       # ESLint
npm run test:e2e   # Playwright-Smoke-Suite (e2e/smoke.spec.ts, braucht laufenden Dev-Server bzw. Build)
```

**Environment:** `.env.local` mit `NEXT_PUBLIC_SUPABASE_URL` und
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `src/lib/supabaseClient.ts` hat Placeholder-Fallbacks,
damit Preview-Branches ohne Env-Vars trotzdem bauen – auf `main` sind echte Werte gesetzt.

**Tests:** Playwright-Smoke-Suite in `e2e/smoke.spec.ts` (`npm run test:e2e`, Konfiguration
`playwright.config.ts`). Darüber hinaus läuft Verifikation über Lint, `npx tsc --noEmit`
und manuelles Testen (s. „Manuell zu testen").

## Deployment

Push auf `main` → Vercel deployed automatisch.

**Build-Check vor Push:** `npm run lint` + `npx tsc --noEmit`. Der lokale `npm run build`
scheitert häufig an Turbopack+FullCalendar (`Can't resolve '@fullcalendar/core'`) – das ist
KEIN eigener Bug, Vercel nutzt einen anderen Bundler-Pfad und baut sauber. Nur Fehler in
eigenen Dateien sind echte Blocker.

```bash
git add -A
git commit -m "feat: [beschreibung]"
git push
```

## Design-Spec (abgestimmt mit Claudian – verbindlich)

Detailwerte (Token-Hexwerte, Card-/Button-/Icon-/Banner-Varianten, TeamCard-Aufbau) stehen
im Skill `fcb-komponente-bauen` → `.claude/skills/fcb-komponente-bauen/design-spec.md`.
Vollständige Designdoku: Obsidian `02 Projekte/FCB Website.md`. Kanonische Vorbilder:
`Header.tsx` und die Primitive in `src/components/ui/` – erst dort prüfen, dann bauen.

- **Vereinskontext**: FCB = 1. FC 1911 Burgkunstadt (2× Herren, E-/F-/G-Jugend) · JFG =
  JFG Kunstadt-Obermain (A-/B-/C-/D-Jugend, teils B1+B2). Gleiche Basis-Palette, andere Akzentfarbe.
- **Dual-Theme**: `fcb.*`-Tokens (`bg-fcb-bg`, `bg-fcb-surface`, `border-fcb-border`,
  `text-fcb-text`, `text-fcb-muted`) lösen per CSS-Variablen je `.dark`/`.light` auf (Default
  dunkel, Umschalter im Footer). Alle Routen inkl. Hero/Auth folgen dem Theme – keine
  always-dark-Inseln. **Jede Komponente in beiden Themes testen.** Keine magic hex, kein `gray-*`.
- **Akzent**: `fcb-accent` (tenant-abhängig, FCB blau / JFG rot) für alles generische
  Marken-Chrome (Buttons, Links, aktive States, Fokus). `fcb-blue`/`fcb-red` nur für feste
  Trägerzuordnung von Teams (`getTeamAccent(traeger)` aus `lib/teams.ts`) und `danger`/`error`.
- **Typografie**: Headlines `font-oswald` (600–700, gern uppercase – NICHT `font-display`,
  das ist nicht an next/font gebunden), Fließtext `font-inter`.
- **Flächen**: Cards `rounded-2xl border border-fcb-border bg-fcb-surface p-6`, Abhebung per
  Border statt Schatten, Hover nur Border-Farbe (kein Scale/Lift). Tints immer
  `bg-<akzent>/10` + `border-<akzent>/40`.
- **Keine Emojis** – nur Lucide (Brand-Icons über `BrandIcons.tsx`). **Framer Motion** für alle
  Animationen, `prefers-reduced-motion` respektieren. Smart-Sticky-Nav und ~1,5 s Ladescreen
  mit Wappen sind gesetzt.
- **A11y**: WCAG AA, Fokus-States immer sichtbar, Icon-only-Buttons mit deutschem `aria-label`.
- **Statusmeldungen**: `ui/Banner.tsx`. „Wartet auf Freigabe/Prüfung" ist immer `warning`
  (gelb). **Rollen-Gates** immer über `ui/ZugriffsHinweis.tsx` statt eigener
  „Kein Zugriff"-Seite: `ausstehend`/unbekannte Rolle (fail-closed) → `warning` „Konto wartet
  auf Freigabe"; freigeschaltete, aber unzureichende Rolle → `info` „Rolle nicht vorgesehen".
  `UserDropdown.tsx` zeigt allen Eingeloggten alle Bereiche – die Zielseite kommuniziert den
  fehlenden Zugriff selbst.

## Arbeitsweise: Plan-Modus

Handover-Prompts von Claudian sind grundsätzlich für den Plan-Modus formuliert: Sie
beschreiben Ziele und Anforderungen, keine Implementierungsschritte. Lies den Prompt
vollständig, erstelle einen strukturierten Plan (Was, in welcher Reihenfolge, warum so)
und warte auf Bastis Freigabe – erst dann wird Code geschrieben.

Ausnahme: Bei klar umrissenen Micro-Fixes (einzelne CSS-Anpassung, einzeiliger Bug-Fix,
Text-Änderung) ist Plan Mode unnötiger Overhead – dort direkt umsetzen.

## Session-Ende: Claudian-Update ausgeben

Nach jeder erledigten Aufgabe dieses Format ausgeben.
Basti kopiert es zu Claudian (dem Obsidian-Assistenten), der die Projektdokumentation aktualisiert.

Die Sektion „Manuell zu testen" ist Pflicht – sie darf nie leer bleiben. Basti testet händisch, bevor die nächste Aufgabe beginnt.

```
## Claudian-Update – [Datum]

### Implementiert
- [Was gebaut / geändert wurde]

### Manuell zu testen
Schritt-für-Schritt-Anleitung für Basti – was er im Browser prüfen soll, um sicherzugehen, dass die Änderungen wie erwartet funktionieren. Konkret und vollständig: welche Seite aufrufen, welche Aktion ausführen, was dabei zu sehen sein sollte (Erwartung) und was auf einen Fehler hindeutet.

Beispielformat:
1. [Seite/Funktion] → [Aktion] → [Erwartetes Ergebnis]
2. ...

### Getestet (automatisch / durch Claude)
- [Was Claude selbst geprüft hat, z. B. Build, Lint, Supabase-Queries]

### Offen / Nächster Block
- [Was als nächstes kommt]

### Technische Notizen
- [Wichtige Entscheidungen, Supabase-Änderungen, neue Abhängigkeiten etc.]
```
