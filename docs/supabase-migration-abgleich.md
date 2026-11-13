# Supabase-Migrationsabgleich

Arbeitsstand: 13.11.2026. Der Abgleich verändert ausschließlich das Repository. Produktionsschema, Daten und die Tabelle `supabase_migrations.schema_migrations` wurden dabei nicht verändert.

## Ursache und Korrektur

Die produktive Datenbank enthielt 26 Migrationen, das Repository 11 Dateien. Keine der bisherigen lokalen Versionsnummern entsprach einer Remote-Version. Deshalb konnte Supabase die Historien nicht zuordnen und meldete `Remote migration versions not found in local migrations directory`.

Alle 26 Remote-Einträge enthielten ihr vollständiges SQL in `statements`. Zehn lokale Dateien hatten dieselben SQL-Tokens wie ihre gleichnamigen Remote-Einträge. Ihre Unterschiede bestanden ausschließlich aus Kommentaren und Formatierung. Diese Dateien tragen jetzt die tatsächlich angewendeten Versionsnummern; ihre erklärenden Kommentare bleiben erhalten. Die 16 fehlenden Dateien wurden aus der gespeicherten Remote-Historie rekonstruiert, einschließlich des ursprünglichen Schemas für `profiles`, `buchungen`, Auth-Trigger und RLS.

Der lokale Entwurf `20260812120000_prevent_role_escalation.sql` wurde nach `supabase/migration-archive/` verschoben. Seine spätere, tatsächlich angewendete Ersatzmigration schützt sowohl die Vergabe als auch den Entzug privilegierter Rollen. Den alten Entwurf erneut anzuwenden wäre eine Regression.

`supabase/migration-history.json` dokumentiert die Herkunft, den MD5-Wert des gespeicherten Remote-SQLs und den SHA-256-Wert jeder rekonstruierten lokalen Datei. Der Remote-Hash dient dem historischen Abgleich, nicht als kryptographischer Sicherheitsnachweis. Wegen erhaltener Kommentare können Remote- und lokale Datei-Hashes unterschiedlich sein.

## Zuordnung der vorhandenen Dateien

| Bisherige Version | Tatsächlich angewendete Version | Name |
| --- | --- | --- |
| 20260707120000 | 20260707170739 | create_sportheim_anfragen |
| 20260708120000 | 20260708072023 | allow_trainer_directory_profiles_select |
| 20260924120000 | 20260924151311 | harden_profile_role_changes |
| 20260924120100 | 20260924151336 | tenant_trennung_mitglieder |
| 20260924120150 | 20260924151412 | uebergang_mitglieder_verein_default |
| 20260924120200 | 20260924151426 | least_privilege_haertung |
| 20260924120250 | 20260924151817 | service_role_grants |
| 20260924120260 | 20260924152333 | fremdprofil_old_id_und_baseline |
| 20260924120300 | 20260925124001 | nach_frontend_merge |
| 20261024170000 | 20261024153635 | mail_marker_bestandskonten |

## Verifizierter Produktionsstand

- Alle 26 Historieneinträge enthalten SQL. Die Versionsmenge ist vollständig lokal abgebildet.
- Die letzten historischen Definitionen aller 13 öffentlichen Funktionskörper stimmen nach Entfernung von Kommentaren und Formatierung mit den aktuellen Datenbankdefinitionen überein.
- Alle sechs öffentlichen Tabellen haben RLS aktiviert. Die Profile enthalten die Trigger für Rolleneskalation, Selbständerungen, fremde Profiländerungen und Vereinsänderungen; `mitglieder` enthält den Vereinswächter.
- Der Storage-Bucket `avatars` ist öffentlich, vom Typ `STANDARD` und hat keine gesetzte Größen- oder MIME-Einschränkung. Seine Objektinhalte sind nicht Bestandteil dieses Abgleichs.
- Die produktive Datenbank hat explizite DML-Rechte für `authenticated` auf `mitglieder`. In der historischen Erstellungsmigration fehlen diese GRANTs.

## Getrennt zu schließende Reproduzierbarkeitslücken

Die passende Historie allein beweist keinen vollständigen Neuaufbau. Folgende Punkte brauchen einen isolierten Lauf und gegebenenfalls additive Migrationen:

1. Der Bucket `avatars` wird von keiner historischen Migration angelegt. Seine Anlage muss separat versioniert werden. Ein bestehender Produktionsbucket darf dabei weder ersetzt noch umkonfiguriert werden.
2. Die Historie setzt an einzelnen Stellen voraus, welche Standardrechte die Umgebung bereits vergeben hat. Insbesondere fehlen die expliziten `authenticated`-GRANTs für `mitglieder`. Ein Neuaufbau muss effektive Tabellen-, Funktions-, Sequenz- und Standardrechte gegen den aktuellen Vertrag prüfen. Historische Dateien werden dafür nicht umgeschrieben.
3. Der Avatar-URL-Constraint enthält die produktive Supabase-Domain. Ein isoliertes Projekt benötigt eine bewusst überprüfte Behandlung dieses Herkunftsvertrags, damit Profilbild-Uploads nicht unbemerkt am Constraint scheitern. Die Rekonstruktion verändert diese Sicherheitsregel nicht.
4. Ein vollständiger Replay auf einer frischen Supabase-Datenbank und der anschließende Schemaabgleich stehen zum Zeitpunkt dieses Dokuments noch aus. Lokal waren weder Docker noch die Supabase-CLI verfügbar. Ein erfolgreicher statischer Abgleich ersetzt diesen Test nicht.

## Sicherer Prüfablauf

1. Die versionierten Dateien gegen `migration-history.json` prüfen. Bereits angewendete Migrationen bleiben unveränderlich; weitere Änderungen erhalten neue Versionen.
2. In einer isolierten Supabase-Umgebung ohne Produktionsverbindung alle 26 Migrationen in Versionsreihenfolge ausführen. Auth- und Storage-Grundschema müssen aus Supabase stammen. Keine Produktionsdaten importieren.
3. Tabellen, Spalten, Constraints, Indizes, aktivierte RLS, Policies, Trigger samt Aktivierungszustand sowie effektive Rechte prüfen. Insbesondere Rollen- und Tenant-Grenzen testen.
4. Fehlende Umgebungsbestandteile separat ergänzen und den Neuaufbau wiederholen. Kostenpflichtige Preview-Branches sind dafür nicht automatisch freigegeben.
5. Nach dem Merge die Supabase-Integration kontrollieren. Deaktivierte Preview-Branches können einen übersprungenen Check erzeugen; das ist kein erfolgreicher Migrationstest.

Weder ein ungezieltes `migration repair` noch ein erneutes Anwenden der historischen SQL-Dateien auf Produktion ist Teil dieser Korrektur. Die produktive Historie bleibt die Quelle für die bereits angewendeten Versionsnummern.

## Manuelle Abnahme

- GitHub → den Pull Request mit dem Abgleich öffnen und die Migrationen prüfen → 26 aktive historische Dateien und ein separater archivierter Entwurf; Fehlermerkmale: doppelte Versionen, veränderte SQL-Semantik oder fehlendes Initialschema.
- Supabase-Dashboard → Database/Migrations des Produktionsprojekts öffnen und Versionen vergleichen → Übereinstimmung mit den 26 rekonstruierten Versionen; Fehlermerkmale: zusätzliche ungeklärte Versionen oder erneute Meldung über fehlende lokale Migrationen.
- GitHub → Supabase-Check des Pull Requests öffnen → ein tatsächlicher Testlauf ist von einem deaktivierten beziehungsweise übersprungenen Preview-Lauf klar unterscheidbar; Fehlermerkmal: `SKIPPED` wird als erfolgreiche Schemawiederherstellung gewertet.
- Isolierte Testwebsite → registrieren, Profil öffnen, Profilbild hochladen und mit Testrollen auf Mitgliederverwaltung zugreifen → Profiltrigger, Storage und Tenant-Trennung funktionieren; Fehlermerkmale: fehlender Bucket, `permission denied`, Avatar-Constraint-Verletzung oder fremde Mitgliederdaten. Ausschließlich synthetische Konten in der Testumgebung verwenden.

## Quellen

- [Supabase CLI: Migrationen aus der Historie abrufen](https://supabase.com/docs/reference/cli/supabase-migration-fetch)
- [Supabase: Datenbankmigrationen](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI v3: Zielumgebung und Bestätigungen](https://supabase.com/changelog/supabase-cli-v3)

