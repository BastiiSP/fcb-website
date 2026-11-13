# Supabase-Migrationsabgleich

Arbeitsstand: 13.11.2026. Die historische Rekonstruktion verändert ausschließlich das Repository. Nach einem echten isolierten Replay wurde zusätzlich `20261113090446_reproducible_schema_baseline.sql` per MCP angewendet. Sie ergänzt die Reproduzierbarkeit neuer Umgebungen. Auf Produktion blieben sämtliche geprüften effektiven Rechte, Bucket-Einstellungen, Tabellen und Funktionsdefinitionen unverändert; die Migrationshistorie erhielt den neuen Eintrag und umfasst jetzt 27 Versionen.

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

Die passende Historie allein beweist keinen vollständigen Neuaufbau. Der erste GitHub-Lauf hat alle 26 historischen Migrationen erfolgreich auf einer frischen Supabase-Datenbank ausgeführt. Der anschließende Vertragstest zeigte zu breite geerbte anon-DML-Rechte sowie den fehlenden Bucket; außerdem wurde ein Typvergleich im Test korrigiert.

1. Der Bucket `avatars` wird von keiner historischen Migration angelegt. Die additive Baseline legt ihn ausschließlich bei Fehlen an. Bei abweichender vorhandener Konfiguration bricht sie ab. Bestehende Objekte und Einstellungen werden nicht ersetzt.
2. Die additive Baseline gleicht ausschließlich Tabellen-DML und entsprechende postgres-Standardrechte auf den aus Produktion gelesenen Vertrag ab. Sie enthält auch die zuvor fehlenden ausdrücklichen `authenticated`-GRANTs für `mitglieder`. RLS, Rollenregeln, Trigger, Sequenzrechte und sonstige Tabellenrechte bleiben unangetastet. Die 26 historischen Dateien bleiben unverändert.
3. Der Avatar-URL-Constraint enthält die produktive Supabase-Domain. Ein isoliertes Projekt benötigt eine bewusst überprüfte Behandlung dieses Herkunftsvertrags, damit Profilbild-Uploads nicht unbemerkt am Constraint scheitern. Die Rekonstruktion verändert diese Sicherheitsregel nicht.
4. Der erneute isolierte Replay einschließlich der additiven Baseline und aller Vertragsprüfungen steht zum Zeitpunkt dieses Dokuments noch aus. Der erste Lauf verwendete PostgreSQL 17.11.0.018, Produktion meldet 17.6. Damit wird dieselbe Hauptversion mit unterschiedlichem Wartungsstand geprüft. Lokal waren Docker und die Supabase-CLI nicht vorhanden; der Lauf erfolgt in GitHub Actions ohne Produktionszugangsdaten.

## Nachweis der produktiven Baseline-Anwendung

Die exakte SQL-Datei wurde vor Anwendung unabhängig geprüft. Ein Vorher/Nachher-Abgleich per MCP bestätigte identische 144 effektive Tabellenrechte für anon, authenticated und service_role einschließlich MAINTAIN, REFERENCES, TRIGGER und TRUNCATE. Die postgres-Standardrechte im Schema public und sämtliche geprüften avatars-Bucket-Metadaten sind ebenfalls identisch geblieben. Alle 13 öffentlichen Funktionsdefinitionen sind unverändert. Weiterhin existieren sechs öffentliche Tabellen mit aktivierter RLS. Die neue kanonische Version wurde aus der Remote-Historie übernommen; es gab keine Reparatur bestehender Historieneinträge.

## Sicherer Prüfablauf

1. Die versionierten Dateien gegen `migration-history.json` prüfen. Bereits angewendete Migrationen bleiben unveränderlich; weitere Änderungen erhalten neue Versionen.
2. In einer isolierten Supabase-Umgebung ohne Produktionsverbindung alle 27 Migrationen in Versionsreihenfolge ausführen. Auth- und Storage-Grundschema müssen aus Supabase stammen. Keine Produktionsdaten importieren.
3. Tabellen, Spalten, Constraints, Indizes, aktivierte RLS, Policies, Trigger samt Aktivierungszustand sowie effektive Rechte prüfen. Insbesondere Rollen- und Tenant-Grenzen testen.
4. Fehlende Umgebungsbestandteile separat ergänzen und den Neuaufbau wiederholen. Kostenpflichtige Preview-Branches sind dafür nicht automatisch freigegeben.
5. Nach dem Merge die Supabase-Integration kontrollieren. Deaktivierte Preview-Branches können einen übersprungenen Check erzeugen; das ist kein erfolgreicher Migrationstest.

Weder ein ungezieltes `migration repair` noch ein erneutes Anwenden der historischen SQL-Dateien auf Produktion ist Teil dieser Korrektur. Die produktive Historie bleibt die Quelle für die bereits angewendeten Versionsnummern.

## Manuelle Abnahme

- GitHub → den Pull Request mit dem Abgleich öffnen und die Migrationen prüfen → 26 historische Dateien, eine additive Baseline und ein separater archivierter Entwurf; Fehlermerkmale: doppelte Versionen, veränderte historische SQL-Semantik oder fehlendes Initialschema.
- Supabase-Dashboard → Database/Migrations des Produktionsprojekts öffnen und Versionen vergleichen → Übereinstimmung mit den 27 lokalen Versionen; Fehlermerkmale: zusätzliche ungeklärte Versionen oder erneute Meldung über fehlende lokale Migrationen.
- GitHub → Supabase-Check des Pull Requests öffnen → ein tatsächlicher Testlauf ist von einem deaktivierten beziehungsweise übersprungenen Preview-Lauf klar unterscheidbar; Fehlermerkmal: `SKIPPED` wird als erfolgreiche Schemawiederherstellung gewertet.
- Isolierte Testwebsite → registrieren, Profil öffnen, Profilbild hochladen und mit Testrollen auf Mitgliederverwaltung zugreifen → Profiltrigger, Storage und Tenant-Trennung funktionieren; Fehlermerkmale: fehlender Bucket, `permission denied`, Avatar-Constraint-Verletzung oder fremde Mitgliederdaten. Ausschließlich synthetische Konten in der Testumgebung verwenden.

## Quellen

- [Supabase CLI: Migrationen aus der Historie abrufen](https://supabase.com/docs/reference/cli/supabase-migration-fetch)
- [Supabase: Datenbankmigrationen](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI v3: Zielumgebung und Bestätigungen](https://supabase.com/changelog/supabase-cli-v3)

