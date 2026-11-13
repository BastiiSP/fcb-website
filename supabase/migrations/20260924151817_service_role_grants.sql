-- Migration: DML-Rechte für service_role (angewendet 2026-09-24)
--
-- Befund aus der Sicherheits-Verifikation: service_role hatte auf keiner
-- public-Tabelle SELECT/INSERT/UPDATE/DELETE (dieses Projekt vergibt keine
-- Standard-Grants – dasselbe Muster wie die zweimal vergessenen
-- authenticated-Grants). BYPASSRLS allein reicht nicht, Postgres prüft die
-- Tabellenrechte vorher.
--
-- Folge: /api/benutzer-ablehnen scheiterte bereits beim Lesen des
-- Aufruferprofils ("permission denied") und antwortete immer mit 403 – das
-- Ablehnen ausstehender Registrierungen war damit faktisch kaputt.
--
-- service_role ist der vertrauenswürdige, ausschließlich serverseitig genutzte
-- Schlüssel (nie im Browser). Die Trigger lassen auth.role() = 'service_role'
-- bewusst durch; die Zugriffskontrolle der Route selbst (Token + Rolle des
-- Aufrufers + Zielkonto 'ausstehend') liegt im Route-Code.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Auch für künftige Tabellen, damit der Fehler nicht erneut auftritt.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
