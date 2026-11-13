-- Reproduzierbare Basis nach dem historischen Migrationsabgleich.
-- Der isolierte Neuaufbau erbte breitere DML-Standardrechte als Produktion.
-- Nur DML wird auf den am 13.11.2026 gelesenen Produktionsstand abgeglichen;
-- MAINTAIN, Sequenzrechte, RLS, Trigger und Rollenregeln bleiben unverändert.

revoke select, insert, update, delete
  on public.profiles, public.buchungen, public.mitglieder, public.mannschaftsanfragen
  from anon;

revoke select, update, delete
  on public.keepalive, public.sportheim_anfragen
  from anon;
grant insert on public.keepalive, public.sportheim_anfragen to anon;

revoke select, insert, update, delete on public.keepalive from authenticated;
grant select, insert, update, delete
  on public.profiles, public.buchungen, public.mitglieder,
     public.mannschaftsanfragen, public.sportheim_anfragen
  to authenticated;

grant select, insert, update, delete
  on public.profiles, public.buchungen, public.mitglieder,
     public.mannschaftsanfragen, public.keepalive, public.sportheim_anfragen
  to service_role;

-- Neue Fach-Tabellen brauchen weiterhin ausdrückliche GRANTs. Der Live-Stand
-- enthält diese DML-Defaultrechte ebenfalls nicht für Clientrollen.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

-- Nur fehlende Bucket-Metadaten ergänzen. Ein bestehender Bucket und seine
-- Objekte werden niemals ersetzt. Abweichende Konfiguration bricht die gesamte
-- Migration ab, damit sie nicht stillschweigend andere Einstellungen übernimmt.
do $$
begin
  if exists (
    select 1 from storage.buckets
    where id = 'avatars'
      and (
        name is distinct from 'avatars'
        or public is distinct from true
        or file_size_limit is not null
        or allowed_mime_types is not null
        or type::text is distinct from 'STANDARD'
      )
  ) then
    raise exception 'Der bestehende avatars-Bucket weicht vom verifizierten Basisstand ab.';
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, null, null)
  on conflict (id) do nothing;
end;
$$;
