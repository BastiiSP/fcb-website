# Betrieb, Sicherung und Alarmierung

Stand: 13. November 2026. Dieses Dokument beschreibt belegte Zustände und die noch
offene Inbetriebnahme. Ein vorbereitetes Skript ist kein laufender Monitor und
eine Migrationshistorie ist keine Datensicherung.

## Nachgewiesener Ausgangsstand

| Bereich | Befund | Nachweis oder Grenze |
| --- | --- | --- |
| Supabase | Projekt aktiv, PostgreSQL 17, Organisation im Free-Tarif | Projekt- und Organisationsabfrage über MCP |
| Datenbanksicherung | Kein vollständiger Export, Aufbewahrungsnachweis oder Restore nachgewiesen | MCP stellt keine Backup-Liste oder Dump-Downloads bereit |
| Storage | Bucket `avatars`, öffentlich, Typ `STANDARD`, 4 Objekte mit insgesamt 96.391 Byte laut Metadaten | Nur aggregierte Live-Abfrage, keine Dateiinhalte exportiert |
| Bucket-Grenzen | `file_size_limit` und `allowed_mime_types` sind jeweils `null` | Live-Metadaten, keine impliziten Grenzwerte als Konfiguration übernehmen |
| Vercel | Runtime-Fehlergruppen sind lesbar | `TypeError: fetch failed` mit `ETIMEDOUT` auf `/` gefunden, letzter Treffer am 13.11.2026 um 06:50:22 UTC |
| Alarmierung | Kein zugestellter Alarm nachgewiesen | Observability Plus laut API nicht aktiviert; Integrationsliste mangels Berechtigung nicht einsehbar |
| Anwendung | Analytics und Speed Insights eingebunden, kein eigenständiges Error-Monitoring eingerichtet | Repository-Prüfung |

Supabase empfiehlt im Free-Tarif eigene Exporte außerhalb des Projekts. Eine
Datenbanksicherung umfasst nur Storage-Metadaten, nicht die gespeicherten
Dateien. Die vier Avatar-Dateien müssen zusätzlich gesichert werden.

## Öffentliche HTTP-Prüfung

```sh
node scripts/http-probe.mjs
node --test scripts/http-probe.test.mjs
```

Die Prüfung ruft beide Produktionsstartseiten per GET auf. Sie erwartet direkt
HTTP 200, HTML und `data-tenant="fcb"` beziehungsweise `data-tenant="jfg"` am
Wurzelelement. Weiterleitungen zählen als Fehler, damit beispielsweise eine
versehentliche Umleitung beider Domains auf dieselbe Marke auffällt. Pro Anfrage
gelten 20 Sekunden Zeitlimit und maximal 2 MiB Antwortinhalt.

Ausgegeben werden nur Prüfzeit, Tenant, Ergebnis, fester Fehlercode, HTTP-Status
und Dauer. Es werden keine Konten, Cookies, Antwortinhalte oder Exception-Texte
ausgegeben. Exit-Code `0` bedeutet beide Prüfungen erfolgreich, `1` mindestens
eine fehlgeschlagene Prüfung.

Die Prüfung belegt DNS/TLS/HTTP und die Auslieferung der richtigen Marke. Sie
belegt weder Datenbankzugriff noch Anmeldung, Browser-JavaScript oder BFV-Daten.
Der vorbereitete Workflow `.github/workflows/availability.yml` führt die Prüfung
alle 10 Minuten aus, jeweils ab Minute 3. Er benötigt keine Secrets und keine
zusätzlichen npm-Abhängigkeiten. Änderungen am Prüfer oder seinem Workflow lösen
auch auf Pull Requests einen echten GET-Test beider Produktionsdomains aus.
Erst nach Übernahme auf den Standardbranch und
einem belegten Actions-Lauf gilt er als aktiv. GitHub bietet für Zeitpläne keine
garantierte Startzeit; Läufe können sich verzögern oder entfallen. Bei öffentlichen
Repositories werden Zeitpläne nach 60 Tagen ohne Repository-Aktivität deaktiviert.
Für verbindliche Überwachung rund um die Uhr ist deshalb ein externer Monitor
vorzuziehen. Der E-Mail-Kanal ist separat zu prüfen.

## Backup-Vertrag vor Aktivierung

Folgende Angaben fehlen noch:

1. Anbieter und Zielordner des vorhandenen Cloud-Speichers, Zugriff über eine
   verbundene Anwendung oder einen dafür angelegten eingeschränkten Zugang.
2. Sicherer Zugang für einen Datenbankexport und den separaten Storage-Download.
   Zugangsdaten ausschließlich als Secret oder über die Provider-Anmeldung
   hinterlegen, niemals im Chat, Repository oder Ausführungsprotokoll.
3. Verantwortliche Person für Entschlüsselung und ein davon getrennt verwahrter
   Wiederherstellungsschlüssel.
4. Isolierte Wiederherstellungsumgebung, etwa ein lokaler Supabase-Stack mit
   Container-Laufzeit. Kostenpflichtige Projekte oder Branches benötigen vorher
   eine Kostenfreigabe.

Providerunabhängiger Standardvorschlag, noch nicht aktiviert: `restic` mit einem
privaten S3-kompatiblen Speicher als Ziel. `restic` verschlüsselt die Sicherung
clientseitig. Bestehender Anbieter, Bucket, Zugangsmodell und mögliche Kosten
werden erst nach Bestätigung eingerichtet. Ein verschlüsselter Backup-Speicher
darf nie mit dem öffentlichen Avatar-Bucket identisch sein.

Als konkrete S3-kompatible Option wurde Backblaze B2 mit EU-Region vorgeschlagen.
Laut Anbieterpreis am 13. November 2026 sind die ersten 10 GB kostenlos, danach
werden 6,95 US-Dollar pro TB und Monat berechnet. Das ist ein Vorschlag, kein
eingerichtetes Konto und keine Kostenfreigabe. Region, Zugriffsrechte und mögliche
weitere Nutzungskosten werden vor Einrichtung bestätigt.

Vorgeschlagener Betriebsvertrag, noch nicht als aktiv bestätigt: tägliche
Sicherung von Datenbank und Storage, 7 Tagesstände, 4 Wochenstände und 6
Monatsstände, monatliche Wiederherstellungsprobe, verantwortlicher Empfänger
Basti. Erst nach Messung des
ersten vollständigen Exports und Restores werden RPO und RTO verbindlich
festgelegt. Ein täglicher Lauf würde bei Erfolg ein RPO von höchstens 24 Stunden
anstreben.

## Vollständiger Sicherungslauf

1. Projektzustand und Softwareversionen erfassen. CLI-Befehle anhand der
   installierten Version und `--help` prüfen. Im November 2026 hat Supabase CLI
   v3 das Zielverhalten geändert, daher eine geprüfte Version fest pinnen.
2. Konsistenten Datenbankexport mit Schema, Geschäftsdaten, benötigten
   Auth-Daten, Rollen, Funktionen, Triggern, Grants, RLS-Policies und Sequenzständen
   erstellen. Den Scope anhand der aktuellen Supabase-Anleitung prüfen, statt
   nur `public` zu exportieren. Auth-Passwörter und Sitzungsdaten machen den Dump
   besonders schutzbedürftig.
3. Bucket-Konfiguration und tatsächliche Objektdateien separat über die Storage
   API sichern. Eine Auflistung oder `storage.objects` allein genügt nicht.
   Eine Objektliste mit Dateischlüsseln bleibt Teil des verschlüsselten Backups.
4. Im geschützten Manifest UTC-Zeit, Projekt, Toolversionen, Dateigrößen,
   SHA-256-Prüfsummen, Tabellenzählungen und Objektanzahl festhalten. Keine
   Personendaten im öffentlichen Nachweis. Änderungen während DB- und
   Storage-Export erkennen und nötigenfalls wiederholen, damit Zuordnungen nicht
   unbemerkt auseinanderlaufen.
5. Archiv vor dem Upload verschlüsseln. Erst einen erfolgreichen Upload samt
   erneutem Download und Prüfsummenvergleich als Sicherung werten.
6. Alte Stände erst nach erfolgreicher Sicherung und gemäß bestätigter
   Aufbewahrung entfernen. Ein fehlgeschlagener Lauf muss eine E-Mail auslösen.

Die vorhandene Supabase-Verbindung in dieser Arbeitsumgebung erlaubt SQL und
Metadatenabfragen, liefert aber keinen vollständigen Dump oder Storage-Dateien.
`psql`, `pg_dump`, Supabase CLI und eine Container-Laufzeit waren hier bei der
Bestandsaufnahme nicht verfügbar. Ein Restore auf die Produktion ist kein
isolierter Test und wird dafür nicht verwendet.

### Vorbereitete Backup-Werkzeuge

```sh
bash scripts/backup-create.sh
bash scripts/restore-verify.sh SNAPSHOT LEERES_ZIELVERZEICHNIS
```

`backup-create.sh` exportiert eine Datenbank mit `pg_dump` im Custom-Format und
sichert die Storage-Dateien separat mit SHA-256-Prüfsummen. `restic` verschlüsselt
das Ergebnis im bereits eingerichteten Ziel. Der Lauf benötigt Bash, Node.js,
`psql`, `pg_dump`, `restic` und GNU `sha256sum`, etwa auf einem Linux-Runner.

| Konfiguration | Benötigte Angaben |
| --- | --- |
| Datenbank | `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSFILE`, `PGSSLMODE` |
| Projekt und Storage | `BACKUP_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Verschlüsseltes Ziel | `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE` sowie die zum Speicheranbieter gehörenden Zugangsvariablen |

`SUPABASE_URL` muss genau zum angegebenen Projekt gehören. Der Exporter akzeptiert
nur dessen offiziellen Direkt-Host oder einen offiziellen regionalen Pooler mit
projektbezogenem `postgres`-Nutzer. Den Datenbankhost und den DB-Nutzer zusätzlich
anhand der Verbindungsdaten im Dashboard abgleichen.
`PGSSLMODE=verify-full` mit passendem Zertifikat ist bevorzugt. Das ebenfalls
erlaubte `require` verschlüsselt, prüft aber die Serveridentität nicht vollständig.
Die Passwortdateien müssen außerhalb des Repositorys liegen und restriktive
Dateirechte besitzen.

Das Skript legt vorübergehend unverschlüsselte Daten unter `TMPDIR` ab, mit
privaten Datei- und Verzeichnisrechten. Nur eine vertrauenswürdige, geschützte
Laufzeit verwenden. Die Daten werden am Ende entfernt; dadurch ist keine sichere
Löschung auf einem kompromittierten oder gemeinsam genutzten Datenträger belegt.

Grenzen des vorbereiteten Exporters: `pg_dump --no-owner` sichert keine globalen
Rollen oder Rollenpasswörter und übernimmt keine Eigentümerzuordnungen beim
Restore. Plattformrollen und Eigentümer müssen gesondert berücksichtigt werden.
DB und Storage werden nacheinander gesichert und bilden keinen atomaren
gemeinsamen Zeitpunkt. Plattformkonfiguration, externe Dienste und Schlüssel
werden nicht automatisch gesichert. Aufbewahrung und Zeitplan sind nicht
aktiviert. Diese Lücken müssen vor der Abnahme des vollständigen Backup-Vertrags
geschlossen oder ausdrücklich als akzeptierte Grenzen dokumentiert sein.

`restore-verify.sh` lädt einen Snapshot in ein vorhandenes leeres Verzeichnis und
prüft Manifest, Prüfsummen und Lesbarkeit des Datenbankarchivs. Es benötigt
`restic`, `sha256sum` und `pg_restore`. Es spielt keine Daten ein und belegt deshalb
keine Wiederherstellbarkeit der Anwendung. Der folgende isolierte Restore bleibt
eine zusätzliche Pflichtprüfung.

## Nachweis einer Wiederherstellung

1. Verschlüsseltes Archiv aus dem Cloud-Ziel herunterladen, entschlüsseln und
   alle Prüfsummen prüfen. Die Probe beginnt beim gespeicherten Stand, nicht bei
   den lokalen Quelldateien des Exports.
2. In eine leere, isolierte Umgebung ohne Produktionsdomains, ausgehende
   E-Mails, OAuth-Callbacks oder Webhooks wiederherstellen. Die Zielkennung
   ausdrücklich gegen die Produktionskennung prüfen.
3. Schema, Tabellenzählungen, Sequenzen, Funktionen, Trigger, Grants und RLS mit
   dem Manifest und dem versionierten Vertrag vergleichen. Auch Auth und die
   Verknüpfung zwischen Nutzer und Profil prüfen.
4. Storage-Bucket und Dateien wiederherstellen. Der derzeitige Constraint
   `profiles_avatar_url_storage_check` bindet Avatar-URLs an den Produktionshost.
   Im isolierten Ziel muss er kontrolliert an dessen Storage-Herkunft angepasst
   werden, bevor die Test-URLs umgeschrieben werden. Die Produktion bleibt
   dabei unverändert. Anzahl, Byte-Summe und
   SHA-256-Prüfsummen vergleichen; ein Avatar muss aus dem isolierten Storage
   abrufbar sein. URLs im isolierten Bestand dürfen nicht auf die Produktion
   zeigen.
5. Mit synthetischen Konten auf dem isolierten Ziel Anmeldung, Rollen-Gates und
   Tenant-Trennung prüfen. Keine Live-Security-Tests mit Wegwerfkonten als
   Ersatz für diese Probe starten.
6. Start, Ende, Backup-Zeitpunkt, tatsächlich erreichten Datenstand,
   Wiederherstellungsdauer und Testergebnisse ohne Personendaten dokumentieren.
   Ziel und vertrauliche Testdaten anschließend kontrolliert stilllegen.

## E-Mail-Alarme und Error-Monitoring

Bestätigter Wunsch: E-Mail an Basti. Für die Zustellung fehlen noch die bestätigte
Empfängeradresse und der gewählte, zugängliche Dienst. Eine vorhandene
Kontoadresse wird nicht ungeprüft als Alarmziel übernommen.

| Zweck | Möglicher Weg | Voraussetzung und Grenze |
| --- | --- | --- |
| Ausfall beider Domains | Externer HTTP-Monitor, etwa UptimeRobot Free | Konto, bestätigte E-Mail; zum Prüfzeitpunkt kostenlose HTTP-Prüfung alle 5 Minuten laut Anbieter |
| HTTP-Prüfung aus diesem Repository | Vorbereiteter GitHub-Actions-Lauf mit `http-probe.mjs` | Aktivierung und Laufnachweis offen; fehlgeschlagene Läufe müssen für den Empfänger abonniert sein; Zeitplan kann verzögert laufen |
| Client- und Serverfehler | Sentry Developer oder vorhandener vergleichbarer Dienst | Konto, Projekt, DSN und bestätigter E-Mail-Kanal; keine bloß deaktivierte SDK-Konfiguration als fertiges Monitoring ausgeben |
| Vercel-Anomaliealarme | Vercel Alerts | Dokumentation verlangt Pro/Enterprise und Observability Plus; keine Aktivierung ohne Kostenfreigabe |

Bei einem neuen Error-Monitor nur nötige Fehlerdaten übertragen. Session Replay,
Tracing und Personenbezug bleiben zunächst aus. URLs, Header, Anfrageinhalte und
Fehlermeldungen müssen vor Übertragung auf personenbezogene Daten geprüft und
gefiltert werden. Gefangene Fehler benötigen bewusste Erfassung, da eine
freundliche UI-Fehlermeldung allein keinen Monitoring-Eintrag erzeugt.

Abnahme für einen Alarmkanal:

1. Beide Domains im Normalbetrieb erfolgreich prüfen.
2. Einen ausschließlich dafür vorgesehenen Testmonitor kontrolliert auf eine
   fehlerhafte Test-URL oder einen Teststatus setzen. Keine Produktionsseite
   absichtlich abschalten.
3. Fehlgeschlagene Prüfung, geöffneten Alarm und tatsächlich empfangene E-Mail
   mit UTC-Zeiten abgleichen. Eine grüne Workflow-Konfiguration oder ein
   Provider-Button „Test gesendet“ belegt keine Zustellung.
4. Testmonitor zurücksetzen und die Wiederherstellungsmeldung prüfen. Im
   produktiven Monitor bleiben die richtigen Domains und Empfänger eingetragen.
5. Für Error-Monitoring zusätzlich einen synthetischen Fehler ohne Personendaten
   aus Browser und Server einer isolierten Vorschau erfassen und den zugehörigen
   E-Mail-Alarm nachweisen. Keine dauerhaft öffentlich auslösbare Fehlerroute
   veröffentlichen.

Für GitHub als ersten E-Mail-Kanal: Im persönlichen GitHub-Konto unter
**Settings → Notifications → Actions** E-Mail-Benachrichtigungen für fehlgeschlagene
Läufe aktivieren und die bestätigte Empfängeradresse prüfen. Anschließend unter
**Actions → Verfügbarkeit FCB und JFG → Run workflow** zunächst ohne Alarmprobe
ausführen. Danach einen zweiten Lauf mit `test_alert=true` starten. Dieser lässt
ausschließlich den Job „Kontrollierte E-Mail-Alarmprobe“ mit `ALARM_PROBE`
fehlschlagen und schaltet keine Produktionsseite ab. Die eingegangene Nachricht
muss genau diesem Lauf zugeordnet werden. Zum Abschluss wieder einen normalen
erfolgreichen Lauf starten. Ob GitHub dabei auch eine Wiederherstellungs-E-Mail
sendet, muss separat beobachtet werden, es wird hier nicht vorausgesetzt.

Bei zeitgesteuerten Läufen benachrichtigt GitHub den Ersteller des Workflows,
später den letzten Bearbeiter der Cron-Angabe oder die Person, die den Workflow
wieder aktiviert hat. Diese Zuordnung muss auf Bastis GitHub-Konto zeigen.
Ein erfolgreicher E-Mail-Test eines manuell gestarteten Laufs belegt allein noch
nicht den Empfänger späterer Zeitplanalarme. Auch einen tatsächlichen geplanten
Lauf und dessen auslösendes Konto prüfen.

## Manuelle Prüfung

- Beide Produktionsdomains → Startseite öffnen → richtige Marke und vollständige
  Darstellung; Fehlermerkmale: 5xx, Timeout, falsches Wappen oder falscher Tenant.
- Monitoring-Dienst → beide Monitorziele und E-Mail-Empfänger prüfen → aktuelle
  erfolgreiche Läufe und bestätigter Empfänger; Fehlermerkmale: pausiert, falsche
  Domain, unbestätigte Adresse, keine Ausführung.
- GitHub Actions → Workflow einmal normal und einmal mit `test_alert=true`
  starten → normaler Lauf erfolgreich, Alarmprobe absichtlich fehlgeschlagen und
  zugehörige E-Mail eingegangen; Fehlermerkmale: kein Lauf, falscher Branch,
  ausbleibende E-Mail, Alarmprobe versehentlich als echter Ausfall behandelt.
- E-Mail-Postfach → kontrollierten Alarm und Wiederherstellung abgleichen → beide
  Meldungen zum Test vorhanden; Fehlermerkmale: nur Provider-Protokoll, keine
  zugestellte Nachricht, falsches Ziel.
- Cloud-Ziel → letzten Sicherungsstand und Manifest prüfen → verschlüsseltes
  Archiv im bestätigten Zeitfenster; Fehlermerkmale: nur SQL ohne Storage,
  überalterter Stand, fehlender Prüfsummenvergleich.
- Isolierte Restore-Umgebung → Anmeldung, Rollen, Tenant-Trennung und Avatar
  prüfen → passender Datenstand, RLS aktiv, keine Produktion angesprochen;
  Fehlermerkmale: fehlende Konten/Dateien, Rollenleck, Produktions-URLs.

## Quellen

- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: Changelog](https://supabase.com/changelog)
- [Backblaze B2: Preise](https://www.backblaze.com/cloud-storage/pricing)
- [Vercel: Alerts](https://vercel.com/docs/alerts)
- [UptimeRobot: Tarife](https://uptimerobot.com/pricing/)
- [Sentry: Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [GitHub: Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub: Benachrichtigungen für Workflow-Läufe](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- [GitHub: Actions-Benachrichtigungen einstellen](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
