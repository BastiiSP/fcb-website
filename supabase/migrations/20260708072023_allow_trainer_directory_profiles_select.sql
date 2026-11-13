-- Migration: allow_trainer_directory_profiles_select
-- Trainer/Vorstand/Admin dürfen im Trainer-Verzeichnis nur Profile derselben
-- freigegebenen Rollen sehen, niemals mitglied-/ausstehend-Profile.
create policy "profiles_select_trainer_verzeichnis" on public.profiles
  for select
  to authenticated
  using (
    (select public.get_own_rolle()) = any (array['trainer'::text, 'vorstand'::text, 'admin'::text])
    and rolle = any (array['trainer'::text, 'vorstand'::text, 'admin'::text])
  );

-- Absicherung gegen den bekannten Fehlerfall: Ohne SELECT-GRANT erreicht RLS
-- die Anfrage nicht. Bestehende Grants bleiben unverändert.
do $$
begin
  if not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) then
    grant select on public.profiles to authenticated;
  end if;
end $$;
