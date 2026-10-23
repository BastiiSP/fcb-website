# FCB Website – Projektanweisungen

Gemeinsame Next.js-Codebasis für FCB und JFG; Live-Auftritte `www.fcbuku.de` und `www.jfg-kunstadt-obermain.de`. Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3.4, Framer Motion 12, FullCalendar 6 und Supabase mit Auth/RLS. Öffentliches Repository: keine personenbezogenen Daten, privaten Dokumentpfade oder Zugangsdaten in Anweisungen und Diffs.

## Einstieg und projektspezifische Werkzeuge

- Vor DB-/Auth-/Rollenarbeiten `supabase/AGENTS.md` bzw. die bytegleiche CLAUDE.md als Schema-/Vertragsreferenz und die betroffenen Migrationen lesen.
- Neue Tabellen immer mit `.claude/skills/supabase-tabelle-anlegen` bearbeiten; Rezept enthält `handle_updated_at()`, `get_own_rolle()`, GRANTs und RLS.
- Komponenten immer nach `.claude/skills/fcb-komponente-bauen` und dessen `design-spec.md`; Vorbilder `Header.tsx` und `src/components/ui/` zuerst prüfen.
- Vor Rollen/RLS-Änderungen Skill `rls-rollenkonzept-check` und Agent `rls-rollen-reviewer` nutzen. UI-/Text-/Routingänderungen mit `multi-tenant-konsistenz-reviewer` prüfen, Tenant-E2E mit `e2e-tenant-test-schreiben`.
- **Claude Code:** Projekt-Skills und Agents liegen unter `.claude/`. **Codex:** Dieselben Rezepte direkt lesen bzw. verfügbare äquivalente Werkzeuge nutzen; fehlende Agenten/Verbindungen als Prüflücke benennen.

## Tenant-Vertrag

- `src/proxy.ts` setzt `x-tenant`, Root-Layout `data-tenant`. Nicht in `middleware.ts` umbenennen: Next 16 würde es hier ignorieren.
- Markenwerte ausschließlich in serialisierbarer `src/lib/tenant.ts`; Server nutzt `tenant.server.ts/getTenant()` (dynamische Route ist gewollt), Client `TenantProvider`. Redaktionelle Texte in `vereinstexte.ts`, Rechtstexte in `rechtstexte.ts`.
- Keine Namen/Logos/Texte der Marke hart codieren. Markenexklusive Routen wie `/sportheim` mit `notFound()` und `generateMetadata()` absichern.
- `?tenant=jfg`/`?tenant=fcb` setzt Preview-/localhost-Override (`fcb-tenant`); Produktionsdomains ignorieren ihn. Default auf Preview/localhost: FCB.

## Rollen und Datenbank

Rollensystem nur nach Rücksprache ändern:
- `ausstehend`: nur Profil, wartet auf Freigabe.
- `mitglied`: Mein Verein und Profil, kein Kalenderzugriff.
- `trainer`: Platzbuchungen anlegen/eigene verwalten.
- `vorstand`: Buchungen verwalten, Nutzer freischalten.
- `admin`: zusätzlich Vorstand/Admin vergeben.
Vorstand darf nur ausstehend/mitglied/trainer vergeben. Nur Admin vergibt **und entzieht** Vorstand/Admin.
- DB-Trigger `trg_prevent_role_escalation`, `trg_prevent_self_role_change`, `trg_prevent_fremdprofil_aenderung` und Update-Policy erhalten. Rollenlabels in `src/lib/rollen.ts`.
- Privilegierte API-Routen prüfen Access-Token und Rolle serverseitig. Vorstand darf fremde Profile nur in `rolle` ändern; `verein` nur Admin.
- `profiles` (Plural) und `rolle` (Singular/String), niemals `profile` oder `rollen`.
- DB-Operationen über Supabase MCP; tatsächlichen Zugang prüfen. RLS immer aktiv, auch Server Components brauchen den RLS-Check.
- Supabase-Calls mit try/catch und verständlichen Fehlern. Migrationen in `supabase/migrations/` versionieren, im beauftragten Umfang per MCP anwenden und live prüfen; Datei allein belegt keine Ausführung.
- Für neue Tabellen explizite Rechte für `authenticated` (`SELECT, INSERT, UPDATE, DELETE`) und benötigte `service_role`-Rechte prüfen. RLS greift erst nach GRANT; Default-Privileges nicht ungeprüft annehmen.
- Direkte SQL-Wartung an `profiles` braucht innerhalb derselben autorisierten Transaktion `set local request.jwt.claims = '{"role":"service_role"}';` wegen der Trigger.
- Mitglieder strikt nach `verein && get_own_verein()` trennen; `trg_mitglieder_verein_guard` erhalten. Trainer-Verzeichnis nur über `trainer_verzeichnis()` mit festen Spalten.
- Öffentliche Sportheim-Belegung nur über `sportheim_belegte_zeiten()` ohne Personendaten; Preise in `src/lib/sportheim.ts` sind Platzhalter.
- `keepalive`/`.github/workflows/supabase-keepalive.yml` schreibt alle drei Tage per anon-INSERT; nicht für Fachfunktionen umbauen.
- `npm run test:e2e:security` erzeugt Wegwerfkonten in der Live-DB: nur bewusst im autorisierten Umfang starten.

## UI, Design und Inhalte

- Keine `any`-Types, explizite Interfaces. UI, Fehlermeldungen und Kommentare Deutsch. Kommentare erklären nicht offensichtlichen Kontext/Warum, RLS, Workarounds und bewusste Entscheidungen.
- Tailwind v3, keine `@theme`-Directive. Alle Flächen über `fcb.*`-Tokens/CSS-Variablen, Default dunkel mit Footer-Umschalter. Auch Hero/Auth in beiden Themes testen; keine always-dark-Inseln, magic hex oder `gray-*`.
- `fcb-accent` für markenabhängige Buttons/Links/aktive States/Fokus; `fcb-blue`/`fcb-red` nur feste Team-Trägerfarben über `getTeamAccent()` bzw. danger/error.
- Headlines `font-oswald` (600–700, gern uppercase), nie `font-display`; Fließtext `font-inter`.
- Cards `rounded-2xl border border-fcb-border bg-fcb-surface p-6`, Border statt Schatten; Hover nur Border, kein Scale/Lift. Tints `bg-<akzent>/10` und `border-<akzent>/40`.
- Keine Emojis. Lucide, Brand-/Social-Icons aus `BrandIcons.tsx`; `react-icons` nicht neu verwenden. Framer Motion für Animationen, reduced motion beachten. Smart-Sticky-Nav und ungefähr 1,5-s-Wappen-Ladescreen erhalten.
- WCAG AA, sichtbarer Fokus und deutsche aria-labels für Icon-Buttons.
- Meldungen über `ui/Banner.tsx`. Wartet auf Freigabe/Prüfung = warning/gelb. Rollen-Gates über `ui/ZugriffsHinweis.tsx`: ausstehend/unbekannt fail-closed warning „Konto wartet auf Freigabe“, andere unzureichende Rolle info „Rolle nicht vorgesehen“.
- `UserDropdown` zeigt allen Eingeloggten alle Bereiche, Zielseiten erklären Zugriff. Rollenabhängige Funktionen und Redirects `/kalender` → `/platzbuchung`, `/vorstand` → `/vorstandsbereich` erhalten.
- News nutzt Instagram statt CMS. ConsentGate erst für echte Client-Einbettungen nutzen; Instagram-next/image-Proxy und serverseitiger BFV-Abruf sind keine solchen Konsumenten.
- Fertige optimierte Bildassets flach mit sprechenden Namen in `public/`, Originale in `assets-source/<kategorie>/` außerhalb öffentlicher Auslieferung. Vor neuen Dateien ähnliche Namen in `public/` suchen.

## BFV-Spielbetrieb

Öffentliche BFV-Widget-API `https://widget-prod.bfv.de/api/service/widget/v1` verwenden, nicht fussball.de. `BFV_TEAMS` in `src/lib/bfv.ts` pflegt nur stabile `teamPermanentId`; Liga/Staffel/compoundId aus Matches ableiten. Anleitung steht über der Konstante. Cache 1 Stunde (`revalidate=3600`), nicht häufiger pollen. Debug: `/api/spielbetrieb?team=herren-1`, ohne Parameter alle Teams. UI in `src/components/spielbetrieb/`.

## Entwicklung und Fertigstellung

- `npm run dev`, `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`; `npm run test:e2e` braucht laufenden Server/Build.
- `npm run build` kann lokal an Turbopack/FullCalendar-Auflösung scheitern. Den konkreten Fehler zuordnen, nicht jeden Buildfehler pauschal ausnehmen; lint und TypeScript vor autorisiertem Push prüfen.
- `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Preview-Platzhalter im Client erlauben Build ohne produktive Werte.
- Push auf main löst Vercel-Deployment aus. Nur eigene beauftragte Änderungen gezielt stagen.
- **Arbeitsweise: Plan-Modus.** Handover-Prompts aus dem AI Brain sind grundsätzlich für den Plan-Modus formuliert: Sie beschreiben Ziele und Anforderungen, keine Implementierungsschritte. Den Prompt vollständig lesen, einen strukturierten Plan erstellen (Was, in welcher Reihenfolge, warum so) und auf Bastis Freigabe warten – erst dann Code schreiben. Ausnahme: klar umrissene Micro-Fixes (einzelne CSS-Anpassung, einzeiliger Bug-Fix, Text-Änderung) direkt umsetzen.
- Nach Aufgaben unter „Prüfung“ konkrete vollständige manuelle Browser-Schritte mit Seite, Aktion, erwartetem Ergebnis und Fehlermerkmalen liefern; diese Testschritte nie leer lassen. Der Nutzer testet vor der nächsten Entwicklungsaufgabe.

## Pflege dieses Dateipaars

Direkte aktuelle Nutzeraufträge haben Vorrang. Vor Regeländerungen beide Dateien lesen und Unterschiede inhaltlich zusammenführen; gültige Regeln erhalten. AGENTS.md und CLAUDE.md unmittelbar gemeinsam ändern und danach mit `cmp` auf Bytegleichheit prüfen. Anbieterunterschiede ausdrücklich kennzeichnen und in beiden Dateien führen. Codex lädt AGENTS.md; Claude Code lädt bei diesem Paar CLAUDE.md.

## Abschluss: AI Brain Update

Zum Abschluss, bei Übergabe oder Abbruch eines Arbeitsauftrags ein kompaktes, eigenständig verständliches Update in diesem Format ausgeben; auch bei Recherche, Planung und Dokumentation. Reine Zwischenfragen und Brainstorming normal und knapp beantworten. Projekt eindeutig benennen, Datum des Arbeitsstands in Europe/Berlin verwenden und tatsächliche Ergebnisse von Plänen unterscheiden. Alle vier Abschnitte beibehalten; fehlende Prüfungen und leere Angaben ehrlich kennzeichnen. Keine Zugangsdaten oder privaten absoluten Pfade aufnehmen. Das Update ersetzt keine unabhängige Prüfung und behauptet keine automatische Übertragung ins AI Brain.

Unter „Prüfung“ zusätzlich manuelle Testschritte als „Seite → Aktion → Erwartung; Fehlermerkmale“ angeben.

```text
## AI Brain Update – [Projekt] – [YYYY-MM-DD]

**Projektkennung:** [Workspace-Ordner oder Repository]
**Auftrag:** [Kurze Beschreibung]
**Stand:** [abgeschlossen / teilweise / blockiert; Version oder Commit, falls vorhanden]

### Ergebnis
- [Tatsächliche Änderungen oder Erkenntnisse; relevante Dateien/Artefakte]

### Prüfung
- [Durchgeführte Prüfung und Ergebnis; nicht geprüft bzw. unabhängige Abnahme offen ausdrücklich nennen]

### Offen / Nächster Schritt
- [Offene Punkte, Blocker und nächster Schritt; sonst keine]

### Hinweise
- [Bestätigte Entscheidungen von Vorschlägen trennen; fachliche/technische Besonderheiten, neue Pakete, IDs etc.; sonst keine]
```
