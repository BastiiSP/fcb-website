-- Härtung der buchungen-Policies (Basis: Codex-Analyse 2026-07-07).
-- Ziel laut Rollenkonzept + Feature "Meine Buchungen":
--   * Vorstand/Admin verwalten alle Buchungen.
--   * Jede Person darf ihre EIGENEN Buchungen bearbeiten/stornieren – fremde nie.
--   * Kalenderrollen (trainer/vorstand/admin) sehen alle Buchungen (Kalender + Kollisionsprüfung),
--     alle anderen sehen nur ihre eigenen (z. B. Alt-Buchungen nach Rollen-Rückstufung).
-- Bestehende Policies vollständig ersetzen, damit keine ältere, permissive Policy parallel greift.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'buchungen'
  loop
    execute format('drop policy if exists %I on public.buchungen', policy_record.policyname);
  end loop;
end $$;

-- Lesen: Kalenderrollen sehen alles, jede Person zusätzlich die eigenen Buchungen.
create policy "Buchungen lesen (kalenderrollen + eigene)"
on public.buchungen
for select
to authenticated
using (
  public.get_own_rolle() in ('trainer', 'vorstand', 'admin')
  or user_id = (select auth.uid())
);

-- Anlegen: Vorstand/Admin frei; Trainer nur unter der eigenen user_id
-- (verhindert, dass Trainer Buchungen im Namen anderer anlegen).
create policy "Buchung anlegen (trainer eigene, vorstand/admin alle)"
on public.buchungen
for insert
to authenticated
with check (
  public.get_own_rolle() in ('vorstand', 'admin')
  or (
    public.get_own_rolle() = 'trainer'
    and user_id = (select auth.uid())
  )
);

-- Bearbeiten: eigene Buchung ODER Vorstand/Admin. Explizites WITH CHECK spiegelt
-- USING und verhindert das Umhängen einer eigenen Buchung auf eine fremde user_id.
create policy "Buchung bearbeiten (eigene + vorstand/admin)"
on public.buchungen
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.get_own_rolle() in ('vorstand', 'admin')
)
with check (
  user_id = (select auth.uid())
  or public.get_own_rolle() in ('vorstand', 'admin')
);

-- Stornieren/Löschen: eigene Buchung ODER Vorstand/Admin.
create policy "Buchung loeschen (eigene + vorstand/admin)"
on public.buchungen
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.get_own_rolle() in ('vorstand', 'admin')
);
