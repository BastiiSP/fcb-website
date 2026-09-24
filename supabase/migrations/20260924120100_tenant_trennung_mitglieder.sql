-- Migration: Vereinszuordnung fuer Profile und Mitglieder einfuehren
-- Die Zuordnung trennt FCB- und JFG-Mitgliederdaten strikt auf Datenbankebene,
-- damit ein Vorstand nur Datensaetze seines eigenen Vereins verwalten kann.

alter table public.profiles
  add column if not exists verein text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_verein_check;

alter table public.profiles
  add constraint profiles_verein_check
  check (verein <@ array['fcb'::text, 'jfg'::text]);

-- Der Bypass gilt nur innerhalb dieses Blocks. Er ist erforderlich, weil die
-- vorherige Migration fremde Profilfelder bereits gegen Updates absichert.
-- Bei einem Fehler wird der Schalter vor dem erneuten Ausloesen zurueckgesetzt.
do $$
begin
  perform set_config('app.bypass_self_change', 'on', true);

  update public.profiles as p
  set verein = coalesce(
    nullif(
      array(
        select distinct
          case
            when zuordnung.mannschaft = any (
              array[
                '1. Mannschaft'::text,
                '2. Mannschaft'::text,
                'E-Junioren (U11)'::text,
                'F-Junioren (U9)'::text,
                'G-Junioren/Bambini (U7)'::text
              ]
            ) then 'fcb'::text
            when zuordnung.mannschaft = any (
              array[
                'A-Junioren (U19)'::text,
                'B-Junioren (U17)'::text,
                'C-Junioren (U15)'::text,
                'D-Junioren (U13)'::text
              ]
            ) then 'jfg'::text
          end
        from unnest(coalesce(p.mannschaft, '{}'::text[])) as zuordnung(mannschaft)
        where zuordnung.mannschaft = any (
          array[
            '1. Mannschaft'::text,
            '2. Mannschaft'::text,
            'E-Junioren (U11)'::text,
            'F-Junioren (U9)'::text,
            'G-Junioren/Bambini (U7)'::text,
            'A-Junioren (U19)'::text,
            'B-Junioren (U17)'::text,
            'C-Junioren (U15)'::text,
            'D-Junioren (U13)'::text
          ]
        )
        order by 1
      ),
      '{}'::text[]
    ),
    array['fcb'::text]
  )
  where cardinality(p.verein) = 0;

  perform set_config('app.bypass_self_change', 'off', true);
exception
  when others then
    perform set_config('app.bypass_self_change', 'off', true);
    raise;
end;
$$;

alter table public.mitglieder
  add column if not exists verein text[];

-- Nicht zuordenbare Altwerte stammen aus dem bisherigen reinen FCB-Betrieb und
-- werden deshalb bewusst dem FCB statt einem offenen Mandanten zugeordnet.
update public.mitglieder as m
set verein = coalesce(
  nullif(
    array(
      select distinct
        case
          when zuordnung.mannschaft = any (
            array[
              '1. Mannschaft'::text,
              '2. Mannschaft'::text,
              'E-Junioren (U11)'::text,
              'F-Junioren (U9)'::text,
              'G-Junioren/Bambini (U7)'::text
            ]
          ) then 'fcb'::text
          when zuordnung.mannschaft = any (
            array[
              'A-Junioren (U19)'::text,
              'B-Junioren (U17)'::text,
              'C-Junioren (U15)'::text,
              'D-Junioren (U13)'::text
            ]
          ) then 'jfg'::text
        end
      from unnest(coalesce(m.mannschaft, '{}'::text[])) as zuordnung(mannschaft)
      where zuordnung.mannschaft = any (
        array[
          '1. Mannschaft'::text,
          '2. Mannschaft'::text,
          'E-Junioren (U11)'::text,
          'F-Junioren (U9)'::text,
          'G-Junioren/Bambini (U7)'::text,
          'A-Junioren (U19)'::text,
          'B-Junioren (U17)'::text,
          'C-Junioren (U15)'::text,
          'D-Junioren (U13)'::text
        ]
      )
      order by 1
    ),
    '{}'::text[]
  ),
  array['fcb'::text]
)
where m.verein is null;

alter table public.mitglieder
  alter column verein set not null;

-- Kein Default erzwingt, dass die UI die fachlich richtige Zuordnung mitsendet,
-- statt neue Mitglieder unbemerkt einem Verein zuzuschlagen.
alter table public.mitglieder
  alter column verein drop default;

alter table public.mitglieder
  drop constraint if exists mitglieder_verein_check;

alter table public.mitglieder
  add constraint mitglieder_verein_check
  check (
    cardinality(verein) >= 1
    and verein <@ array['fcb'::text, 'jfg'::text]
  );

create or replace function public.get_own_verein()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select verein from public.profiles where id = auth.uid()),
    '{}'::text[]
  );
$$;

create or replace function public.prevent_verein_aenderung()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Die Vereinszuordnung steuert Mandantenzugriff und darf deshalb weder im
  -- eigenen Profil noch durch einen Vorstand eigenmaechtig veraendert werden.
  if new.verein is distinct from old.verein
     and not (
       auth.role() = 'service_role'
       or coalesce(public.get_own_rolle(), '') = 'admin'
     ) then
    raise exception 'Nur admin darf die Vereinszuordnung ändern.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_verein_aenderung on public.profiles;

create trigger trg_prevent_verein_aenderung
  before update on public.profiles
  for each row
  execute function public.prevent_verein_aenderung();

-- Die Policies filtern sowohl bestehende als auch resultierende Zeilen, damit
-- eine Aenderung keinen Datensatz in einen fremden Verein verschieben kann.
drop policy if exists mitglieder_select on public.mitglieder;
drop policy if exists mitglieder_insert on public.mitglieder;
drop policy if exists mitglieder_update on public.mitglieder;
drop policy if exists mitglieder_delete on public.mitglieder;

create policy mitglieder_select on public.mitglieder
  for select
  to authenticated
  using (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and verein && public.get_own_verein()
    )
  );

create policy mitglieder_insert on public.mitglieder
  for insert
  to authenticated
  with check (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and verein && public.get_own_verein()
    )
  );

create policy mitglieder_update on public.mitglieder
  for update
  to authenticated
  using (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and verein && public.get_own_verein()
    )
  )
  with check (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and verein && public.get_own_verein()
    )
  );

create policy mitglieder_delete on public.mitglieder
  for delete
  to authenticated
  using (
    public.get_own_rolle() = 'admin'
    or (
      public.get_own_rolle() = 'vorstand'
      and verein && public.get_own_verein()
    )
  );

create or replace function public.mitglieder_verein_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-Role und Admin duerfen vereinsuebergreifend administrieren; alle
  -- anderen Schreibpfade bleiben zusaetzlich durch RLS eingeschraenkt.
  if auth.role() = 'service_role'
     or coalesce(public.get_own_rolle(), '') = 'admin' then
    return new;
  end if;

  if coalesce(public.get_own_rolle(), '') = 'vorstand' then
    if tg_op = 'INSERT' then
      -- Ein neuer Datensatz darf ausschliesslich eigenen Vereinen zugeordnet
      -- werden, auch wenn eine ueberlappende RLS-Pruefung sonst genuegen wuerde.
      if not (new.verein <@ public.get_own_verein()) then
        raise exception 'Vereinszuordnung außerhalb des eigenen Vereins ist nicht erlaubt.';
      end if;
    elsif tg_op = 'UPDATE' then
      -- Beide Richtungen sind noetig: Hinzufuegen und Entfernen eines fremden
      -- Vereins waeren sonst jeweils ueber die verbleibende Ueberlappung moeglich.
      if not (
        new.verein <@ (old.verein || public.get_own_verein())
        and old.verein <@ (new.verein || public.get_own_verein())
      ) then
        raise exception 'Vereinszuordnung außerhalb des eigenen Vereins ist nicht erlaubt.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mitglieder_verein_guard on public.mitglieder;

create trigger trg_mitglieder_verein_guard
  before insert or update on public.mitglieder
  for each row
  execute function public.mitglieder_verein_guard();

-- Die bestehende Namensableitung bleibt wortgleich, damit E-Mail- und OAuth-
-- Registrierungen unveraendert funktionieren. Mannschaften werden absichtlich
-- nicht mehr aus benutzerkontrollierten Metadaten uebernommen, weil dafuer der
-- gepruefte Mannschaftsanfragen-Workflow vorgesehen ist.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    vorname,
    nachname,
    telefonnummer,
    mannschaft,
    rolle,
    verein
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'vorname', ''),
      new.raw_user_meta_data->>'given_name',
      split_part(
        coalesce(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          ''
        ),
        ' ',
        1
      ),
      ''
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'nachname', ''),
      new.raw_user_meta_data->>'family_name',
      nullif(
        substring(
          coalesce(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            ''
          )
          from '\s(.*)$'
        ),
        ''
      ),
      ''
    ),
    new.raw_user_meta_data->>'telefonnummer',
    null,
    'ausstehend',
    case
      when new.raw_user_meta_data->>'verein' in ('fcb', 'jfg')
        then array[new.raw_user_meta_data->>'verein']
      else '{}'::text[]
    end
  );

  return new;
end;
$$;

-- Nur angemeldete Nutzer brauchen den RLS-Helfer. Triggerfunktionen sind keine
-- oeffentlichen RPC-Endpunkte und erhalten deshalb keinerlei Client-EXECUTE.
revoke execute on function public.get_own_verein() from public, anon;
grant execute on function public.get_own_verein() to authenticated;

revoke execute on function public.prevent_verein_aenderung()
  from public, anon, authenticated;
revoke execute on function public.mitglieder_verein_guard()
  from public, anon, authenticated;
