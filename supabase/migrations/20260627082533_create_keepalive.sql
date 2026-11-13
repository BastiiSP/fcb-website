-- Zweck: Write-basierter Keep-Alive für das Supabase Free-Tier-Projekt.
-- Der GitHub Actions Cron-Job schreibt alle 3 Tage einen Eintrag via anon-Key,
-- damit Supabase echte Datenbankaktivität registriert und das Projekt nicht pausiert.
-- GET-Leseanfragen werden von Supabase offenbar nicht als Aktivität gezählt.

create table public.keepalive (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null    default now(),
  updated_at timestamptz not null    default now()
);

-- updated_at automatisch pflegen (vorhandene Funktion – nicht neu anlegen)
create trigger set_keepalive_updated_at
  before update on public.keepalive
  for each row execute function public.handle_updated_at();

-- Nur anon-Rolle darf einfügen – der GitHub Actions Workflow nutzt den Anon-Key.
-- Kein authenticated-GRANT nötig, da kein Anwendungsfall im Frontend existiert.
grant insert on public.keepalive to anon;

alter table public.keepalive enable row level security;

-- INSERT für anon erlaubt (check = true, da kein Nutzer-Kontext vorhanden/benötigt)
create policy "keepalive_anon_insert" on public.keepalive
  for insert with check (true);
