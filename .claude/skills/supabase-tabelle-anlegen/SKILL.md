---
name: supabase-tabelle-anlegen
description: Beim Anlegen einer neuen Supabase-/Postgres-Tabelle im FCB-Projekt – Migration mit RLS-Policies und GRANT. Triggert bei neue Tabelle, apply_migration, RLS-Policy schreiben, GRANT, updated_at-Trigger, neues Datenbankschema.
---

# Supabase-Tabelle anlegen (FCB)

## Überblick

Verifiziertes, vollständiges Rezept für eine neue Tabelle in diesem Projekt.
**Kernprinzip:** Funktionsnamen und Muster nicht raten – sie sind unten festgehalten.
Ein Agent, der die Trigger-Funktion riet, nahm `update_updated_at_column()` (existiert
nicht) → Migration wäre gescheitert. Die korrekte Funktion ist `handle_updated_at()`.

Stand der verifizierten Fakten: 2026-06-01 (gegen Live-DB `jktvmckqfklfziszfsxf` geprüft).

## Verifizierte Bausteine (NICHT raten)

| Baustein | Korrekter Wert |
|---|---|
| updated_at-Triggerfunktion | `public.handle_updated_at()` – **existiert bereits, nicht neu anlegen** |
| Trigger-Name | `set_<tabelle>_updated_at` |
| Rollen-Helper für RLS | `public.get_own_rolle()` (`STABLE SECURITY DEFINER`, liefert `rolle` aus `profiles`) |
| Primärschlüssel | `uuid primary key default gen_random_uuid()` |
| User-Verweis | `uuid references auth.users(id) on delete set null` |

`get_own_rolle()` statt Inline-`EXISTS (SELECT … FROM profiles)` verwenden – Letzteres
verursacht RLS-Rekursion auf `profiles`. Die alte `buchungen`-Tabelle nutzt noch das
Inline-Muster; **nicht kopieren**, `get_own_rolle()` ist der aktuelle Standard.

## Migrations-Template

```sql
-- Migration: create_<tabelle>
create table public.<tabelle> (
  id           uuid primary key default gen_random_uuid(),
  -- ... fachliche Spalten ...
  erstellt_von uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- updated_at automatisch pflegen (vorhandene Funktion wiederverwenden)
create trigger set_<tabelle>_updated_at
  before update on public.<tabelle>
  for each row execute function public.handle_updated_at();

-- KRITISCH: Ohne GRANT greift RLS nie (Postgres bricht vorher mit "permission denied" ab).
-- Bereits zweimal vergessen (buchungen, mitglieder).
grant select, insert, update, delete on public.<tabelle> to authenticated;

alter table public.<tabelle> enable row level security;

-- RLS-Policies: hier das Muster "nur vorstand/admin" (Vorbild: mitglieder).
-- SELECT/DELETE via USING (qual), INSERT via WITH CHECK, UPDATE via beides.
create policy "<tabelle>_select" on public.<tabelle>
  for select using (get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "<tabelle>_insert" on public.<tabelle>
  for insert with check (get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "<tabelle>_update" on public.<tabelle>
  for update using (get_own_rolle() = any (array['vorstand'::text, 'admin'::text]))
          with check (get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "<tabelle>_delete" on public.<tabelle>
  for delete using (get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));
```

### Lese-Zugriff anpassen (nur die SELECT-`USING`-Klausel tauschen)

| Wer darf lesen | `using (...)` |
|---|---|
| Alle eingeloggten Rollen | `auth.uid() is not null` |
| Nur vorstand/admin | `get_own_rolle() = any (array['vorstand'::text, 'admin'::text])` |
| Nur eigene Zeilen | `user_id = auth.uid()` |
| Eigene + vorstand/admin | `user_id = auth.uid() or get_own_rolle() = any (array['vorstand'::text,'admin'::text])` |

Schreib-Policies bleiben i. d. R. auf vorstand/admin (oder zusätzlich `trainer`, je nach
Rollenkonzept – im Zweifel mit Basti klären, das Rollensystem ist kritisch).

## Workflow-Checkliste

1. **Plan-Modus**: Neue Tabelle ist kein Micro-Fix → Plan erstellen, Bastis Freigabe abwarten. Offene Designfragen (CHECK-Werte, Lese-/Schreibrechte, Storage vs. URL) vorab klären.
2. **Migration anwenden** via MCP `apply_migration`, Name `create_<tabelle>`. CHECK-Constraints für Enum-artige TEXT-Spalten nicht vergessen (Muster: `buchungen`).
3. **Security-Advisor** via MCP `get_advisors` (type `security`) prüfen – keine Warnung „RLS disabled" oder „policy exists but RLS not enabled".
4. **RLS scharf gegenprüfen**: Test-`SELECT`/`INSERT` als verschiedene Rollen – bestätigen, dass GRANT + Policies greifen (nicht-berechtigte Rolle muss abgewiesen werden).
5. **TypeScript-Interface** anlegen (strict, kein `any`; Union-Types für CHECK-Spalten). Optional Konstanten-Datei in `src/lib/` (Vorbild `mannschaften.ts`).
6. **CLAUDE.md** aktualisieren: Tabelle im Abschnitt „Datenbankschema" + neue Dateipfade ergänzen.
7. **Build/Lint**: `npm run lint`. Hinweis: lokaler `npm run build` kann an Turbopack+FullCalendar scheitern – wenn der Fehler ausschließlich daher rührt, kein Blocker (Vercel-Build greift).
8. **Commit & Push** auf `main` (`feat:`-Präfix), Vercel deployt automatisch.
9. **AI Brain Update** im Format der Projektwurzel (`AGENTS.md`/`CLAUDE.md`) ausgeben; konkrete manuelle Testschritte unter „Prüfung“ sind Pflicht.

## Häufige Fehler

| Fehler | Folge / Fix |
|---|---|
| Trigger-Funktion geraten (`update_updated_at_column` o. ä.) | Migration scheitert. Immer `handle_updated_at()`. |
| GRANT vergessen | RLS greift nie, „permission denied". GRANT-Zeile ist Pflichtbestandteil. |
| Inline-`EXISTS … FROM profiles` in Policy | RLS-Rekursion. Stattdessen `get_own_rolle()`. |
| `enable row level security` vergessen | Tabelle offen für alle `authenticated`. Advisor schlägt an. |
| Neue `handle_updated_at()`-Funktion anlegen | Doppelung. Vorhandene Funktion wiederverwenden. |
| CLAUDE.md nicht aktualisiert | Schema-Doku driftet. Schritt 6 ist Teil der Aufgabe. |
