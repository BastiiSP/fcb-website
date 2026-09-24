-- Migration: Profil- und Rollenaenderungen haerten
-- Die Regeln liegen bewusst in RLS und Triggern, damit direkte Data-API-Aufrufe
-- dieselben Grenzen wie die Benutzeroberflaeche einhalten muessen.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-Role-Aufrufe stammen aus geschuetzter serverseitiger Administration.
  -- In einer SECURITY-DEFINER-Funktion waere current_user nur der Funktionsowner,
  -- deshalb muss hier die vom JWT gesetzte Rolle ausgewertet werden.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Nicht nur das Vergeben, sondern auch das Entziehen privilegierter Rollen ist
  -- adminpflichtig, damit ein Vorstand keine fremden Vorstandsrechte veraendert.
  if new.rolle is distinct from old.rolle
     and (
       new.rolle in ('vorstand', 'admin')
       or old.rolle in ('vorstand', 'admin')
     )
     and coalesce(public.get_own_rolle(), '') <> 'admin' then
    raise exception 'Nur admin darf die Rolle vorstand/admin vergeben oder entziehen.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;

create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_escalation();

-- Die Policy begrenzt bereits die erreichbaren Alt- und Neuzeilen. Der Trigger
-- oben bleibt als zweite Schranke bestehen, falls sich Policies spaeter aendern.
drop policy if exists "Vorstand und Admin vergeben Rollen" on public.profiles;

create policy "Vorstand und Admin vergeben Rollen" on public.profiles
  for update
  to authenticated
  using (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and rolle in ('ausstehend', 'mitglied', 'trainer')
    )
  )
  with check (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and rolle in ('ausstehend', 'mitglied', 'trainer')
    )
  );

create or replace function public.prevent_fremdprofil_aenderung()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Diese Ausnahmen sind fuer serverseitige Administration, die atomare
  -- Mannschaftsanfragen-RPC, Admins und die normale Eigenprofilpflege noetig.
  if auth.role() = 'service_role'
     or current_setting('app.bypass_self_change', true) = 'on'
     or coalesce(public.get_own_rolle(), '') = 'admin'
     or auth.uid() = new.id then
    return new;
  end if;

  -- Ein Vorstand darf an fremden Profilen nur die fachlich vorgesehene Rolle
  -- aendern; updated_at wird vom bestehenden Zeitstempel-Trigger mitgepflegt.
  if (to_jsonb(new) - 'rolle' - 'updated_at')
       is distinct from
     (to_jsonb(old) - 'rolle' - 'updated_at') then
    raise exception 'Vorstand darf bei fremden Profilen nur die Rolle ändern.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_fremdprofil_aenderung on public.profiles;

create trigger trg_prevent_fremdprofil_aenderung
  before update on public.profiles
  for each row
  execute function public.prevent_fremdprofil_aenderung();

-- Eine feste Storage-Herkunft verhindert, dass fremde Tracking- oder Bild-URLs
-- als Profilbild gespeichert und spaeter von der Website geladen werden.
alter table public.profiles
  drop constraint if exists profiles_avatar_url_storage_check;

alter table public.profiles
  add constraint profiles_avatar_url_storage_check
  check (
    avatar_url is null
    or avatar_url ~ '^https://jktvmckqfklfziszfsxf\.supabase\.co/storage/v1/object/public/avatars/'
  );

-- WITH CHECK stellt sicher, dass ein Eigenprofil-Update die Zeile nicht aus dem
-- eigenen Besitzbereich verschieben kann, selbst wenn sich das Schema erweitert.
drop policy if exists "Eigenes Profil updaten" on public.profiles;

create policy "Eigenes Profil updaten" on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
