-- Ausschließlich im isolierten CI-Supabase ausführen. Synthetische Konten und
-- alle Teständerungen liegen in einer zurückgerollten Transaktion.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public'),
  6,
  'Alle sechs Anwendungstabellen wurden rekonstruiert'
);

select ok(
  exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = tabellen.name and c.relrowsecurity
  ),
  tabellen.name || ': RLS ist aktiviert'
)
from unnest(array['profiles', 'buchungen', 'mitglieder', 'mannschaftsanfragen', 'keepalive', 'sportheim_anfragen']) as tabellen(name);

select ok(
  exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = erwartet.schema_name and c.relname = erwartet.table_name
      and t.tgname = erwartet.trigger_name and not t.tgisinternal and t.tgenabled = 'O'
  ),
  erwartet.trigger_name || ': Schutztrigger ist aktiv'
)
from (values
  ('auth', 'users', 'on_auth_user_created'),
  ('public', 'profiles', 'trg_prevent_role_escalation'),
  ('public', 'profiles', 'trg_prevent_self_role_change'),
  ('public', 'profiles', 'trg_prevent_fremdprofil_aenderung'),
  ('public', 'profiles', 'trg_prevent_verein_aenderung'),
  ('public', 'mitglieder', 'trg_mitglieder_verein_guard')
) as erwartet(schema_name, table_name, trigger_name);

-- Einzelne Rechte prüfen: has_table_privilege mit einer Kommaliste würde
-- bereits bei einem einzigen vorhandenen Recht true liefern.
select ok(
  has_table_privilege('authenticated', 'public.' || tabellen.name, rechte.name),
  tabellen.name || ': authenticated besitzt ' || rechte.name
)
from unnest(array['profiles', 'buchungen', 'mitglieder', 'mannschaftsanfragen', 'sportheim_anfragen']) as tabellen(name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as rechte(name);

select ok(
  has_table_privilege('service_role', 'public.' || tabellen.name, rechte.name),
  tabellen.name || ': service_role besitzt ' || rechte.name
)
from unnest(array['profiles', 'buchungen', 'mitglieder', 'mannschaftsanfragen', 'keepalive', 'sportheim_anfragen']) as tabellen(name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as rechte(name);

select ok(
  not has_table_privilege('anon', 'public.' || tabellen.name, rechte.name),
  tabellen.name || ': anon besitzt kein ' || rechte.name
)
from unnest(array['profiles', 'buchungen', 'mitglieder', 'mannschaftsanfragen']) as tabellen(name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as rechte(name);

select ok(has_table_privilege('anon', 'public.keepalive', 'INSERT'), 'Keepalive erlaubt anon INSERT');
select ok(has_table_privilege('anon', 'public.sportheim_anfragen', 'INSERT'), 'Sportheim erlaubt öffentliche Anfragen');
select ok(
  not has_table_privilege('anon', 'public.' || tabellen.name, rechte.name),
  tabellen.name || ': anon besitzt kein ' || rechte.name
)
from unnest(array['keepalive', 'sportheim_anfragen']) as tabellen(name)
cross join unnest(array['SELECT', 'UPDATE', 'DELETE']) as rechte(name);
select ok(
  not has_table_privilege('authenticated', 'public.keepalive', rechte.name),
  'Keepalive besitzt kein authenticated-' || rechte.name
)
from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as rechte(name);
select ok(
  not exists (
    select 1 from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclobjtype = 'r' and r.rolname in ('anon', 'authenticated')
      and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  'Neue Tabellen erhalten keine pauschalen Client-DML-Rechte'
);
select ok(has_function_privilege('anon', 'public.sportheim_belegte_zeiten()', 'EXECUTE'), 'Öffentliche Sportheim-Belegung ist aufrufbar');
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join unnest(p.proargnames) as argument(name)
    where n.nspname = 'public' and p.proname = 'sportheim_belegte_zeiten'
      and argument.name in ('name', 'email', 'telefon', 'telefonnummer', 'kontakt_name', 'kontakt_email', 'kontakt_telefon')
  ),
  'Öffentliche Sportheim-Belegung gibt keine Kontaktfelder zurück'
);

select ok(
  has_function_privilege('authenticated', 'public.' || rpc.signatur, 'EXECUTE')
  and not has_function_privilege('anon', 'public.' || rpc.signatur, 'EXECUTE'),
  rpc.signatur || ': RPC nur für authenticated'
)
from unnest(array['get_own_rolle()', 'get_own_verein()', 'trainer_verzeichnis()', 'approve_mannschaftsanfrage(uuid)', 'close_mannschaftsanfrage_banner(uuid)']) as rpc(signatur);

select ok(
  not has_function_privilege(rollen.name, 'public.' || funktionen.name || '()', 'EXECUTE'),
  funktionen.name || ': keine direkte Ausführung durch ' || rollen.name
)
from unnest(array['handle_new_user', 'handle_updated_at', 'prevent_role_escalation', 'prevent_self_role_change', 'prevent_fremdprofil_aenderung', 'prevent_verein_aenderung', 'mitglieder_verein_guard']) as funktionen(name)
cross join unnest(array['anon', 'authenticated']) as rollen(name);

select ok(
  exists (select 1 from storage.buckets where id = 'avatars' and public),
  'Der öffentliche avatars-Bucket ist reproduzierbar angelegt'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_trainer_verzeichnis'),
  'Das Trainerverzeichnis besitzt keine breite Profil-SELECT-Policy'
);
select is(
  (select column_default::text from information_schema.columns where table_schema = 'public' and table_name = 'mitglieder' and column_name = 'verein'),
  null::text,
  'Mitglieder benötigen eine ausdrückliche Vereinszuordnung'
);

-- Nur synthetische Testdatensätze, keine übernommenen Bestandskonten.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'vorstand-fcb@example.invalid', '{"vorname":"Test","nachname":"Vorstand FCB","verein":"fcb"}'),
  ('10000000-0000-4000-8000-000000000002', 'vorstand-jfg@example.invalid', '{"vorname":"Test","nachname":"Vorstand JFG","verein":"jfg"}'),
  ('10000000-0000-4000-8000-000000000003', 'mitglied@example.invalid', '{"vorname":"Test","nachname":"Mitglied","verein":"fcb"}'),
  ('10000000-0000-4000-8000-000000000004', 'admin@example.invalid', '{"vorname":"Test","nachname":"Admin","verein":"fcb"}');

select is(
  (select count(*)::integer from public.profiles where id::text like '10000000-%' and rolle = 'ausstehend'),
  4,
  'Registrierungen erhalten ausschließlich ausstehende Profile'
);

set local request.jwt.claims = '{"role":"service_role"}';
update public.profiles set rolle = 'vorstand' where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
update public.profiles set rolle = 'mitglied' where id = '10000000-0000-4000-8000-000000000003';
update public.profiles set rolle = 'admin' where id = '10000000-0000-4000-8000-000000000004';
insert into public.mitglieder (vorname, nachname, verein) values
  ('Test', 'Nur FCB', array['fcb']), ('Test', 'Nur JFG', array['jfg']);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}';
select is((select count(*)::integer from public.mitglieder), 1, 'FCB-Vorstand sieht ausschließlich FCB-Mitglieder');
select throws_ok(
  $$update public.profiles set rolle = 'admin' where id = '10000000-0000-4000-8000-000000000003'$$,
  'P0001', 'Nur admin darf die Rolle vorstand/admin vergeben oder entziehen.',
  'Vorstand kann ein Mitglied nicht zum Admin machen'
);
select throws_ok(
  $$update public.profiles set vorname = 'Manipuliert' where id = '10000000-0000-4000-8000-000000000003'$$,
  'P0001', 'Vorstand darf bei fremden Profilen nur die Rolle ändern.',
  'Vorstand kann fremde Stammdaten nicht ändern'
);
select throws_ok(
  $$insert into public.mitglieder (vorname, nachname, verein) values ('Test', 'Fremder Verein', array['fcb', 'jfg'])$$,
  'P0001', 'Vereinszuordnung außerhalb des eigenen Vereins ist nicht erlaubt.',
  'Vorstand kann keine fremde Vereinszuordnung ergänzen'
);
select lives_ok(
  $$update public.profiles set rolle = 'trainer' where id = '10000000-0000-4000-8000-000000000003'$$,
  'Vorstand darf einem Mitglied die Trainerrolle geben'
);
select is((select rolle from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'trainer', 'Trainerrolle wurde tatsächlich vergeben');
select lives_ok(
  $$update public.profiles set rolle = 'mitglied' where id = '10000000-0000-4000-8000-000000000003'$$,
  'Vorstand darf die Trainerrolle entziehen'
);
with geaendert as (
  update public.profiles set rolle = 'mitglied' where id = '10000000-0000-4000-8000-000000000004' returning id
)
select is(
  (select count(*)::integer from geaendert),
  0,
  'Vorstand kann Adminrechte nicht entziehen'
);
with geaendert as (
  update public.profiles set rolle = 'mitglied' where id = '10000000-0000-4000-8000-000000000002' returning id
)
select is(
  (select count(*)::integer from geaendert),
  0,
  'Vorstand kann fremde Vorstandsrechte nicht entziehen'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}';
select is((select count(*)::integer from public.mitglieder), 1, 'JFG-Vorstand sieht ausschließlich JFG-Mitglieder');
select is((select verein[1] from public.mitglieder limit 1), 'jfg', 'JFG-Vorstand sieht tatsächlich den JFG-Datensatz');

set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000003"}';
select is((select count(*)::integer from public.mitglieder), 0, 'Mitglied sieht keine Mitgliederverwaltung');
select throws_ok(
  $$update public.profiles set rolle = 'trainer' where id = '10000000-0000-4000-8000-000000000003'$$,
  'P0001', 'Die eigene Rolle darf nicht geändert werden',
  'Mitglied kann sich nicht selbst zum Trainer machen'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000004"}';
select lives_ok(
  $$update public.profiles set rolle = 'vorstand' where id = '10000000-0000-4000-8000-000000000003'$$,
  'Admin darf Vorstandsrechte vergeben'
);
select is((select rolle from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'vorstand', 'Vorstandsrolle wurde tatsächlich vergeben');
select lives_ok(
  $$update public.profiles set rolle = 'admin' where id = '10000000-0000-4000-8000-000000000003'$$,
  'Admin darf Adminrechte vergeben'
);
select is((select rolle from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'admin', 'Adminrolle wurde tatsächlich vergeben');
select lives_ok(
  $$update public.profiles set rolle = 'mitglied' where id = '10000000-0000-4000-8000-000000000003'$$,
  'Admin darf Adminrechte entziehen'
);
select is((select rolle from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'mitglied', 'Adminrolle wurde tatsächlich entzogen');
reset role;

select * from finish();
rollback;
