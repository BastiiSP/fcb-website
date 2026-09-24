-- Migration: Berechtigungen auf das fachlich notwendige Minimum reduzieren
-- Direkte Tabellen- und Funktionsrechte werden enger gefasst, damit RLS nicht
-- durch ueberbreite Standardrechte oder frei aufrufbare Definer-Funktionen leidet.

create or replace function public.trainer_verzeichnis()
returns table (
  id uuid,
  vorname text,
  nachname text,
  telefonnummer text,
  rolle text,
  mannschaft text[],
  strasse text,
  plz text,
  ort text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Die Funktion gibt nur die fuer das Verzeichnis benoetigten Spalten frei,
  -- damit sensible Profilfelder nicht ueber eine breite SELECT-Policy abfliessen.
  select
    p.id,
    p.vorname,
    p.nachname,
    p.telefonnummer,
    p.rolle,
    p.mannschaft,
    p.strasse,
    p.plz,
    p.ort
  from public.profiles as p
  where p.rolle in ('trainer', 'vorstand', 'admin')
    and coalesce(public.get_own_rolle(), '') in ('trainer', 'vorstand', 'admin')
  order by p.nachname, p.vorname;
$$;

revoke execute on function public.trainer_verzeichnis() from public, anon;
grant execute on function public.trainer_verzeichnis() to authenticated;

-- Das Entfernen der alten Policy profiles_select_trainer_verzeichnis folgt
-- bewusst erst in 20260924120300_nach_frontend_merge.sql: Das live
-- ausgelieferte Trainer-Verzeichnis liest bis zum Merge noch direkt aus
-- profiles und wuerde sonst leer angezeigt.

-- Herabgestufte Nutzer duerfen alte eigene Buchungen nicht weiter veraendern.
-- Vorstand und Admin behalten fuer die Verwaltung Zugriff auf alle Buchungen.
drop policy if exists "Buchung loeschen (eigene + vorstand/admin)" on public.buchungen;

create policy "Buchung loeschen (eigene + vorstand/admin)" on public.buchungen
  for delete
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and public.get_own_rolle() in ('trainer', 'vorstand', 'admin')
    )
    or public.get_own_rolle() in ('vorstand', 'admin')
  );

drop policy if exists "Buchung bearbeiten (eigene + vorstand/admin)" on public.buchungen;

create policy "Buchung bearbeiten (eigene + vorstand/admin)" on public.buchungen
  for update
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and public.get_own_rolle() in ('trainer', 'vorstand', 'admin')
    )
    or public.get_own_rolle() in ('vorstand', 'admin')
  )
  with check (
    (
      user_id = (select auth.uid())
      and public.get_own_rolle() in ('trainer', 'vorstand', 'admin')
    )
    or public.get_own_rolle() in ('vorstand', 'admin')
  );

-- Fachliche RPCs bleiben nur fuer angemeldete Nutzer erreichbar. Interne
-- Triggerfunktionen duerfen dagegen nie direkt ueber die Data API aufgerufen werden.
revoke execute on function public.get_own_rolle() from public, anon;
grant execute on function public.get_own_rolle() to authenticated;

revoke execute on function public.approve_mannschaftsanfrage(uuid) from public, anon;
grant execute on function public.approve_mannschaftsanfrage(uuid) to authenticated;

revoke execute on function public.close_mannschaftsanfrage_banner(uuid) from public, anon;
grant execute on function public.close_mannschaftsanfrage_banner(uuid) to authenticated;

revoke execute on function public.prevent_role_escalation()
  from public, anon, authenticated;
revoke execute on function public.prevent_self_role_change()
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.handle_updated_at()
  from public, anon, authenticated;
revoke execute on function public.prevent_fremdprofil_aenderung()
  from public, anon, authenticated;

-- Ein leerer search_path verhindert, dass gleichnamige Objekte aus einem
-- beschreibbaren Schema aufgeloest werden. Die Funktionskoerper qualifizieren
-- ihre Tabellen bereits mit public.; NOW() und auth.uid() bleiben eindeutig.
alter function public.close_mannschaftsanfrage_banner(uuid)
  set search_path = '';
alter function public.sportheim_belegte_zeiten()
  set search_path = '';

-- Anonyme Clients benoetigen keine Profildaten. Die technischen Keepalive-
-- Inserts bleiben dagegen absichtlich mit dem anon-Schluessel funktionsfaehig.
revoke select on public.profiles from anon;
revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;

alter policy "Eigenes Profil lesen" on public.profiles
  to authenticated;
alter policy "Vorstand und Admin lesen alle Profile" on public.profiles
  to authenticated;

alter policy "Eigene offene Anfragen loeschen" on public.mannschaftsanfragen
  to authenticated;
alter policy anfragen_insert_own on public.mannschaftsanfragen
  to authenticated;
alter policy anfragen_select_own on public.mannschaftsanfragen
  to authenticated;
alter policy anfragen_select_vorstand on public.mannschaftsanfragen
  to authenticated;
alter policy anfragen_update_vorstand on public.mannschaftsanfragen
  to authenticated;

alter policy keepalive_anon_insert on public.keepalive
  to anon;

-- Dieselben Rechte werden fuer kuenftige postgres-Tabellen entzogen, damit neue
-- Migrationen nicht erneut gefaehrliche Standardprivilegien erben.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
