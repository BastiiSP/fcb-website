-- Migration: create_sportheim_anfragen
-- Gemeinsame Zeitquelle fuer oeffentliche Sportheim-Anfragen und interne Sperrtermine.

create table public.sportheim_anfragen (
  id             uuid primary key default gen_random_uuid(),
  typ            text not null default 'anfrage',
  vorname        text,
  nachname       text,
  email          text,
  telefonnummer  text,
  startzeit      timestamptz not null,
  endzeit        timestamptz not null,
  anlass         text,
  nachricht      text,
  status         text not null default 'offen',
  erstellt_von   uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint sportheim_anfragen_typ_check
    check (typ = any (array['anfrage'::text, 'sperrung'::text])),
  constraint sportheim_anfragen_status_check
    check (status = any (array['offen'::text, 'angenommen'::text, 'abgelehnt'::text])),
  constraint sportheim_anfragen_zeitraum_check
    check (endzeit > startzeit),
  constraint sportheim_anfragen_anfrage_pflichtfelder_check
    check (
      typ <> 'anfrage'
      or (
        vorname is not null and length(btrim(vorname)) > 0
        and nachname is not null and length(btrim(nachname)) > 0
        and email is not null and length(btrim(email)) > 0
        and telefonnummer is not null and length(btrim(telefonnummer)) > 0
        and anlass is not null and length(btrim(anlass)) > 0
      )
    ),
  constraint sportheim_anfragen_sperrung_regeln_check
    check (
      typ <> 'sperrung'
      or (
        status = 'angenommen'
        and vorname is null
        and nachname is null
        and email is null
        and telefonnummer is null
      )
    )
);

-- updated_at automatisch pflegen (vorhandene Funktion wiederverwenden).
create trigger set_sportheim_anfragen_updated_at
  before update on public.sportheim_anfragen
  for each row execute function public.handle_updated_at();

alter table public.sportheim_anfragen enable row level security;

-- Vorstand/Admin verwalten alle Zeilen inklusive Statuswechsel und Sperrterminen.
create policy "sportheim_anfragen_select" on public.sportheim_anfragen
  for select
  to authenticated
  using (public.get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "sportheim_anfragen_insert_vorstand_admin" on public.sportheim_anfragen
  for insert
  to authenticated
  with check (public.get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "sportheim_anfragen_update" on public.sportheim_anfragen
  for update
  to authenticated
  using (public.get_own_rolle() = any (array['vorstand'::text, 'admin'::text]))
  with check (public.get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

create policy "sportheim_anfragen_delete" on public.sportheim_anfragen
  for delete
  to authenticated
  using (public.get_own_rolle() = any (array['vorstand'::text, 'admin'::text]));

-- Oeffentliche Anfragen duerfen ohne Login erstellt werden, aber nie direkt angenommen
-- oder einer beliebigen Auth-User-ID zugeordnet werden.
create policy "sportheim_anfragen_insert_oeffentliche_anfrage" on public.sportheim_anfragen
  for insert
  to anon, authenticated
  with check (
    typ = 'anfrage'
    and status = 'offen'
    and erstellt_von is null
  );

-- Ohne GRANT bricht Postgres vor der RLS-Pruefung mit "permission denied" ab.
grant select, insert, update, delete on public.sportheim_anfragen to authenticated;
grant insert on public.sportheim_anfragen to anon;

-- Anonym lesbare Kalenderquelle: gibt bewusst nur belegte Zeitfenster ohne Kontakt-
-- oder Anlassdaten aus. Offene und abgelehnte Anfragen bleiben unsichtbar.
create or replace function public.sportheim_belegte_zeiten()
returns table (
  startzeit timestamptz,
  endzeit   timestamptz,
  typ       text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sportheim_anfragen.startzeit,
    sportheim_anfragen.endzeit,
    sportheim_anfragen.typ
  from public.sportheim_anfragen
  where sportheim_anfragen.status = 'angenommen'
     or sportheim_anfragen.typ = 'sperrung'
  order by sportheim_anfragen.startzeit asc;
$$;

revoke all on function public.sportheim_belegte_zeiten() from public;
grant execute on function public.sportheim_belegte_zeiten() to anon;
grant execute on function public.sportheim_belegte_zeiten() to authenticated;
