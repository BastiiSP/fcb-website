# Betrieb, Sicherung und Alarmierung

Stand: 13. November 2026. Dieses Dokument beschreibt belegte Zustände und die noch
offene Sicherungsinbetriebnahme. Ein vorbereitetes Skript ist kein laufender
Monitor und eine Migrationshistorie ist keine Datensicherung.

## Eingesetzte Dienste

| Dienst | Aufgabe | Aktueller Betrieb und Kostenrahmen |
| --- | --- | --- |
| GitHub | Öffentliches Repository, Pull Requests, CI, Schema-Replay und Sicherungsworkflows | `main` geschützt; fünf Pflichtchecks; öffentliche Standardrunner; kein bezahlter Runner. [Prozess und Nachweise](entwicklungsprozess.md) |
| Vercel | Bereitstellung derselben Anwendung für FCB und JFG | Beide Domains produktiv; kein kostenpflichtiges Observability Plus aktiviert |
| Supabase | PostgreSQL, Auth und Storage | Free-Projekt; 27 Migrationen abgeglichen. Kostenpflichtiges natives Preview-Branching deaktiviert, kostenloser isolierter Schema-Replay aktiv. [Abgleich](supabase-migration-abgleich.md) |
| Backblaze B2 | Verschlüsseltes externes Sicherungsziel | EU Central, privat, kein Zahlungsmittel, 0-Dollar-Caps; Export verschlüsselt gespeichert und erneut heruntergeladen; isolierter Restore noch offen |
| Sentry | Unbehandelte Client-, Server- und Edge-Fehler samt E-Mailalarm | EU-Projekt, Developer-Grundplan mit befristetem Test; SDK produktiv, beide Fehlerwege und Regression-Alarme in geschützter Vorschau belegt; Vertragsannahme offen |
| UptimeRobot | Externe Erreichbarkeitsprüfung beider Domains | Free, zwei aktive HTTP-Monitore alle fünf Minuten; Down-/Up-E-Mails belegt; Testmonitor pausiert |

Keine zusätzlichen kostenpflichtigen Dienste aktivieren. Die folgenden Abschnitte
sind die maßgebliche Quelle für Einrichtung, Nachweise und verbleibende Grenzen.

## Nachgewiesener Ausgangsstand

| Bereich | Befund | Nachweis oder Grenze |
| --- | --- | --- |
| Supabase | Projekt aktiv, PostgreSQL 17, Organisation im Free-Tarif | Projekt- und Organisationsabfrage über MCP |
| Datenbanksicherung | Produktiver Export und verschlüsselter B2-Upload erfolgreich; Download, Prüfsummen und Archivlesbarkeit bestätigt | Lauf `43475169764`: isolierter Restore fehlgeschlagen; Zeitplan bleibt gesperrt |
| Storage | Bucket `avatars`, öffentlich, Typ `STANDARD`; bestätigter Ausgangsbestand 4 Objekte mit insgesamt 96.391 Byte | Dateien zusätzlich zum Datenbankexport im verschlüsselten Backup enthalten; isolierter Wiederherstellungsnachweis offen |
| Bucket-Grenzen | `file_size_limit` und `allowed_mime_types` sind jeweils `null` | Live-Metadaten, keine impliziten Grenzwerte als Konfiguration übernehmen |
| Vercel | Runtime-Fehlergruppen sind lesbar | `TypeError: fetch failed` mit `ETIMEDOUT` auf `/` gefunden, letzter Treffer am 13.11.2026 um 06:50:22 UTC |
| Öffentliche HTTP-Prüfung | Beide Domains liefern HTTP 200 und den richtigen Tenant | Erfolgreicher manueller Main-Lauf `43461402737`, geprüft am 13.11.2026 um 16:18:38 UTC |
| GitHub-Fehlermail | Allgemeine und gezielte Verfügbarkeits-Alarmmail an Basti zugestellt | Schema-Replay am 13.11.2026 um 09:02:09 UTC, Commit `964787d`; Verfügbarkeits-Alarmprobe um 09:07:12 UTC, Commit `3e8d9dc`, Lauf `43398573784` |
| Vercel-Anomaliealarme | Observability Plus nicht aktiviert, kein Vercel-Alarm nachgewiesen | Kostenpflichtige Erweiterung außerhalb des Auftrags; Sentry separat eingerichtet |
| Sentry | Kostenloses EU-Projekt und SDK auf Produktion ausgeliefert; echte Vorschau-Testereignisse und Regression-Alarmmails belegt | Keine gespeicherten Geo-Werte im Retest; beide Produktionsdomains geprüft; DPA noch nicht angenommen |

Supabase empfiehlt im Free-Tarif eigene Exporte außerhalb des Projekts. Eine
Datenbanksicherung umfasst nur Storage-Metadaten, nicht die gespeicherten
Dateien. Der Sicherungslauf exportiert die Avatar-Dateien deshalb zusätzlich.

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
Der PR-#8-Lauf `43398257499` hat beide echten Produktionsanfragen erfolgreich
geprüft: HTTP 200 und passender Tenant. Der Zeitplan gilt erst nach Übernahme auf
den Standardbranch und einem belegten geplanten Actions-Lauf als aktiv.
GitHub bietet für Zeitpläne keine
garantierte Startzeit; Läufe können sich verzögern oder entfallen. Bei öffentlichen
Repositories werden Zeitpläne nach 60 Tagen ohne Repository-Aktivität deaktiviert.
Bis 13.11.2026 um 16:18 UTC war kein geplanter Verfügbarkeitslauf sichtbar.
Der Workflow ist laut GitHub-Oberfläche aktiv und liegt auf dem Standardbranch
`main`. Der manuelle [Main-Lauf 43461402737](https://github.com/BastiiSP/fcb-website/actions/runs/43461402737)
prüfte beide Domains erfolgreich: HTTP 200 und passender Tenant; die Alarmprobe
wurde übersprungen. Dies belegt keinen Zeitplanbetrieb. Die konkrete Ursache
fehlender Schedule-Ereignisse und deren Benachrichtigungszuordnung bleiben offen.
Der E-Mail-Kanal für kontrollierte PR-Fehler ist separat belegt.

## Kostenfreiheit und vorbereitete Sicherung

Verbindliche Vorgabe: keine privaten Kosten. Keine Zahlungsmittel, bezahlten
Tarife, Mehrverbrauchsabrechnung oder kostenpflichtigen Runner aktivieren.

### Bestätigter Backblaze-Zustand

Das neue B2-Konto liegt in EU Central. E-Mail ist bestätigt, Zwei-Faktor-Anmeldung
ist aktiv, Business Groups sind deaktiviert. Die Kontoseite zeigte 0 Dollar und
„Zahlungsweise eingeben“, also kein hinterlegtes Zahlungsmittel.

| Einstellung | Live geprüft |
| --- | --- |
| Speicherlimit | 0 Dollar, maximal 10 GB |
| Downloadlimit | 0 Dollar, maximal 1 GB pro Tag |
| Class B und C | jeweils maximal 2.500 Vorgänge pro Tag |
| E-Mail-Warnungen | aktiviert |
| Backup-Bucket | privat, EU Central, serverseitige Verschlüsselung aktiv; restic-Repository initialisiert |
| Objektversionen | alle Versionen behalten, Object Lock aus |
| Event Notifications und Replikation | nicht eingerichtet |

Diese Grenzen stammen aus dem Konto. Die Skripte können Zahlungsdaten und alle
Abrechnungsfunktionen nicht über die S3-API prüfen. Class D lässt sich beim
Anbieter nicht mit einem Kostenlimit versehen und bleibt ungenutzt. Die
Bestätigung der unveränderten Kontoeinstellungen bleibt Voraussetzung jedes
Betriebs. Weder Caps noch ein Skriptbudget sind eine Zusage des Anbieters über
zukünftige Tarife.

Ein auf den privaten Backup-Bucket begrenzter Anwendungsschlüssel vom UI-Typ
„Read and Write“ ist eingerichtet, einschließlich `listAllBucketNames`, ohne
Dateipräfix- oder Ablaufbeschränkung. Dieser UI-Rechtesatz erlaubt zusätzlich
Änderungen an Bucket-Konfigurationen, darunter Verschlüsselung, Lifecycle,
Logging, Benachrichtigungen und Replikation. Er ist daher kein minimaler
Objektschlüssel. Der geprüfte Backupcode nutzt diese Konfigurationsrechte nicht.
Class D bleibt durch den vorgesehenen Betrieb ungenutzt, ist aber nicht auf
Berechtigungsebene ausgeschlossen.

Alle zehn Backup-Secret-Namen sind in der GitHub-Oberfläche geprüft. Die vier
B2-Secrets wurden dort hinterlegt; der geprüfte Helfer hat die sechs übrigen
Datenbank-, Storage- und restic-Werte erfolgreich übertragen. Die Werte werden
nicht veröffentlicht. Nach erneuter Prüfung der kostenlosen Anbieter-Caps und
der fehlenden Zahlungsweise ist `BACKUP_FREE_TIER_CONFIRMED=true` gesetzt.
`BACKUP_ENABLED` fehlt weiterhin, Environment-Variablen sind leer. Der
Sicherungszeitplan bleibt damit gesperrt.

Der erste echte [Sicherungslauf 43465773099](https://github.com/BastiiSP/fcb-website/actions/runs/43465773099)
scheiterte am 13.11.2026 um 16:46:44 UTC beim Datenbankexport. Kosten-, Werkzeug-
und B2-Budgetprüfung waren erfolgreich; Restore wurde übersprungen und private
Dateien wurden bereinigt. Die zugehörige GitHub-Fehlermail ist um 16:47:07 UTC
im Empfängerpostfach belegt. Das bestätigt die Zustellung für den manuellen
Main-Lauf, nicht für den Zeitplan.

Der frühere [Sicherungslauf 43470959640](https://github.com/BastiiSP/fcb-website/actions/runs/43470959640)
auf `main` (`8793e66`) scheiterte ebenfalls vor dem Exportabschluss. Die begrenzte
Diagnose aus [PR #12](https://github.com/BastiiSP/fcb-website/pull/12) meldet
`SNAPSHOT` und `TLS_SONSTIG`. Die anschließende anmeldungsfreie
[TLS-Probe 43472243295](https://github.com/BastiiSP/fcb-website/actions/runs/43472243295)
bestätigt die Eingrenzung: System-CAs scheitern an der Zertifikatsprüfung, mit der
offiziellen Supabase-CA werden TLS und Hostname bestätigt. Die Produktivkorrektur
verwendet diese lokal versionierte CA mit festem SHA-256; `verify-full` bleibt
aktiv.

Der anschließende [Sicherungslauf 43475169764](https://github.com/BastiiSP/fcb-website/actions/runs/43475169764)
auf `main` (`cde93b3`) hat den produktiven Export und verschlüsselten B2-Upload
abgeschlossen. Erneuter Download, SHA-256-Prüfsummen und Lesbarkeit des
Datenbankarchivs waren erfolgreich. Der nachfolgende isolierte Restore schlug
fehl; private Dateien wurden anschließend bereinigt. Das ist noch kein
vollständiger Wiederherstellungsnachweis. `BACKUP_ENABLED` bleibt aus. Das
restic-Repository ist initialisiert und darf nicht erneut initialisiert werden.
Weitere Restore-Proben verwenden den vorhandenen Stand ohne neuen Quellzugriff.

### GitHub Actions einrichten

Der vorbereitete Workflow `.github/workflows/backup.yml` hat zwei manuelle Modi:
`preflight` prüft nur Laufzeit, B2-Zugang und Speicherbudget, `backup` liest die
Produktion, verschlüsselt den Export und lädt ihn nach B2. Es gibt keinen
PR-Auslöser für Secrets. Auch manuelle Läufe sind auf den geprüften
Standardbranch `main` begrenzt. Normale öffentliche Linux-Runner werden verwendet.

| GitHub-Secret | Inhalt |
| --- | --- |
| `BACKUP_S3_ENDPOINT` | bestätigter HTTPS-S3-Endpunkt der EU-Region |
| `BACKUP_S3_BUCKET` | privater Backup-Bucket |
| `BACKUP_S3_KEY_ID`, `BACKUP_S3_KEY` | Anwendungsschlüssel nur für diesen Bucket, Lesen/Schreiben und Auflisten aller Bucket-Namen |
| `BACKUP_RESTIC_PASSWORD` | starkes neues Passwort mit mindestens 32 Zeichen, getrennte sichere Wiederherstellungskopie aufbewahren |
| `BACKUP_DB_HOST`, `BACKUP_DB_PORT`, `BACKUP_DB_USER` | offizielle direkte Verbindung oder Session-Pooler aus dem Supabase-Dashboard |
| `BACKUP_DB_PASSWORD` | bestehendes Datenbankpasswort, niemals für diesen Auftrag zurücksetzen |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | serverseitiger Schlüssel für den ausschließlich lesenden Storage-Export |

DB-`postgres` und `service_role` sind erhöhte Zugänge und erlauben technisch
mehr als Lesen. Nur der beauftragte Code verwendet sie lesend. Wer Workflows
ändern kann, ist deshalb besonders zu begrenzen. Die Main-Prüfung im Workflow
ersetzt keinen Repository-Schutz und keine Prüfung der zugriffsberechtigten
Konten. Produktive Datenbankzugänge werden nicht in die Restore-Container-
Umgebung übernommen.

Die B2-Vorabprüfung benötigt keine Datenbank- oder Storage-Zugangsdaten. Der
Schlüssel braucht Zugriff auf alle Objektversionen im eigenen Bucket. Keine
Dateipräfix-Beschränkung setzen, die alte Versionen aus der Budgetprüfung
ausblenden würde. Alle Schlüssel ausschließlich über die Provider-Oberfläche und
GitHub Secrets hinterlegen, nicht im Chat, Repository oder Ausführungsprotokoll.

Für die Übertragung vom eigenen angemeldeten Rechner ist der geprüfte Helfer
vorgesehen:

```sh
bash scripts/configure-backup-secrets.sh
```

Er erzwingt `github.com` und das bestätigte Konto mit Administrationsrechten auf
dem Zielrepository. Datenbankpasswort, B2-Schlüssel und restic-Passwort werden
verdeckt eingelesen. Der vorhandene Service-Key wird ausschließlich gezielt aus
`.env.local` gelesen, ohne Shell-Auswertung; alternativ wird er verdeckt
abgefragt. Nach ausdrücklicher Terminalbestätigung überträgt der Helfer die zehn
Werte an `gh secret set` über die Standardeingabe, nicht als Argumente. Er setzt
keine Repository-Variable und aktiviert keinen Zeitplan. Der Helfermodus zum
Erhalten der vier B2-Secrets hat die sechs übrigen Werte erfolgreich übertragen;
zusätzlich bestehen PTY-Tests mit erfundenen Schlüsseln und einem GitHub-Mock.

Sind die vier B2-Secrets bereits über die Provider-Oberfläche hinterlegt, erhält
der Helfer sie mit folgendem Aufruf:

```sh
bash scripts/configure-backup-secrets.sh --preserve-existing-b2
```

Dieser Modus prüft ausschließlich, ob die vier exakten Secret-Namen
`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY_ID` und `BACKUP_S3_KEY`
vorhanden sind. Er liest und validiert deren Werte nicht und fragt die
B2-Schlüssel nicht erneut ab. Fehlt ein Name oder schlägt die Namensabfrage fehl,
bricht er vor Eingaben und Übertragung ab. Nach Terminalbestätigung werden nur
die übrigen sechs Secrets übertragen. Ohne Option bleibt der Modus mit zehn
Secrets erhalten. Vier PTY-Tests mit erfundenen Schlüsseln prüfen beide Modi,
fehlende Namen und die Wiederherstellung des Terminals nach Abbruch; eine
unabhängige Prüfung einschließlich zusätzlicher Fehlerfälle ist erfolgt.

Der manuelle [B2-Preflight 43461145123](https://github.com/BastiiSP/fcb-website/actions/runs/43461145123)
auf `main` war am 13.11.2026 erfolgreich. Um 16:18:36 UTC bestätigte er das
Speicherbudget einschließlich alter Objektversionen. Werkzeugtests bestanden;
Backup- und Restore-Schritte wurden übersprungen. Es wurden keine
Produktionsdaten exportiert oder hochgeladen. Dies belegt den B2-Zugang und die
Budgetprüfung, noch keine Sicherung oder Wiederherstellung.

`BACKUP_ENABLED` bleibt aus. Für die nächste Wiederherstellungsprobe den
manuellen Workflow `.github/workflows/backup-restore.yml` auf `main` ausführen.
Er benötigt nur die vier B2-Secrets und das restic-Passwort. Er legt kein
Repository an und liest weder Datenbank noch Supabase Storage erneut. Der
neueste eindeutige Snapshot muss zu Host `fcb-website`, Tag `fcb-backup`,
Payload, festem Projekt und PostgreSQL-Image passen. Kostenflag und bestehende
Caps bleiben Voraussetzung, die gemeinsame Concurrency verhindert parallele
Backup-Schreibvorgänge. Download und Archivprüfung laufen vor dem isolierten
Restore; sämtliche privaten Dateien werden abschließend entfernt.

Ein täglicher Zeitplan um 03:27 UTC ist vorbereitet. Er arbeitet erst mit
`BACKUP_ENABLED=true`, diese Variable erst nach belegter Sicherung und Restore
setzen. Am ersten Tag des Monats ist zusätzlich ein erneuter Download und
isolierter Datenbank-Restore vorgesehen. GitHub-Zeitpläne bleiben nach bestem
Bemühen und können ausbleiben. Das bestehende E-Mail-Abonnement muss für den
Ersteller dieses Workflows ebenfalls geprüft werden.

### Export, Budget und Verschlüsselung

`backup-create.sh` verwendet einen exportierten PostgreSQL-Snapshot in einer
lesenden Repeatable-Read-Transaktion. Dump und Manifest der Tabellenstände
verwenden denselben Snapshot. Vollständiges Custom-Archiv, Auth-Daten,
Geschäftsdaten, Storage-Metadaten, Eigentümer, RLS, Funktionen, Trigger und Grants
bleiben im verschlüsselten Backup. Rollen und Mitgliedschaften werden ohne
Passwörter als Katalogmetadaten aufgenommen. Die tatsächliche PostgreSQL-Image-
Digest wird aufgezeichnet und für Export und isolierten Restore verwendet.

Der Datenbankzugang wird mit `default_transaction_read_only=on` verwendet.
GitHub Actions prüft das TLS-Serverzertifikat und den Hostnamen mit `verify-full`
und der offiziellen Supabase-CA. Das versionierte Original unter
`scripts/certificates/supabase-prod-ca-2021.crt` hat den fest geprüften SHA-256
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
Die CA wird schreibgeschützt in den Exportcontainer eingebunden; eine fehlende
oder abweichende Datei stoppt den Lauf vor dem Datenbankzugriff.
Der Storage-Bestand wird vor dem Dump und nach den Downloads verglichen.
Abweichungen in Bucket-Einstellungen, Objektidentität, Metadaten oder Dateigrößen
stoppen die Sicherung vor dem Upload. DB und Storage bilden dennoch keinen
atomaren gemeinsamen Zeitpunkt. Kurzzeitige Änderungen zwischen den Inventuren
können unerkannt bleiben, Sequenzwerte sind ebenfalls nicht MVCC-konsistent.

Vor jedem Upload wird der gesamte sichtbare B2-Bestand einschließlich alter
Objektversionen gezählt. Bei laufenden Multipart-Uploads oder mehr als einem
sichtbaren Bucket wird abgebrochen. Das neue Payload darf höchstens 100 MB
haben. Bestand plus dreifache Payload-Größe plus 128 MB Reserve muss unter
8 GB liegen. Diese vorsichtige Zusatzgrenze ersetzt die bestätigten
Anbieter-Caps nicht. Am Limit schlägt die Sicherung fehl, es wird kein Limit
angehoben und kein bezahlter Mehrverbrauch freigeschaltet.

`restic` verschlüsselt vor dem Upload. Auf dem kurzlebigen Runner liegen Daten
vorübergehend unverschlüsselt in einem privaten Verzeichnis mit restriktiven
Dateirechten. Private Diagnoseausgaben bleiben dort. Es werden keine Dumps,
Dateien, Metadaten oder Diagnoseprotokolle als GitHub-Artefakte veröffentlicht.
Das Verzeichnis wird am Ende entfernt. Eine sichere Löschung auf einem
kompromittierten Datenträger ist damit nicht bewiesen.

### Wiederherstellungsumfang und verbleibende Grenzen

`restore-verify.sh` lädt den konkreten neuen Snapshot erneut aus B2, prüft
SHA-256 und Lesbarkeit des Archivs. Mit `BACKUP_ISOLATED_RESTORE=true` startet es
`restore-isolated.mjs`. Dieses erstellt einen frischen Supabase-Postgres-17-
Container ohne Netzwerk, ohne veröffentlichte Ports, ohne SMTP, OAuth oder
Webhooks und eine neue Zieldatenbank. Es gibt keine konfigurierbare produktive
Restore-Adresse. Benötigte fehlende Rollen werden ohne LOGIN und ohne produktive
Passwörter angelegt. Anschließend werden das gesamte Archiv eingespielt und
Tabellenzählungen, RLS, Policies sowie Funktionen, Trigger, Constraints, Grants
und Sequenzen gegen das Manifest verglichen. Storage-Dateien werden erneut
gehasht, separat materialisiert und ihren wiederhergestellten DB-Metadaten
zugeordnet. Der eigene kurzlebige Container wird anschließend entfernt.

Das ist nach erfolgreichem echten Lauf ein Datenbank- und Dateinachweis.
Anmeldung per Auth-API, Browser-Rollen-Gates, Tenant-Trennung und Abruf über die
Storage-API werden damit noch nicht geprüft. Dafür bleibt die folgende
Anwendungsabnahme nötig. Plattformkonfiguration, externe Dienste und
Datenbank-Rollenpasswörter sind nicht Bestandteil dieser Wiederherstellung.
Die Quelle hatte bei der reinen Metadatenprüfung keine Vault-Secrets. Sobald
solche vorhanden sind, bricht der Export ab, weil deren Schlüssel einen eigenen
Wiederherstellungsvertrag benötigen.

Vorgeschlagene Aufbewahrung bleibt 7 Tagesstände, 4 Wochenstände und
6 Monatsstände, monatliche Restore-Probe. Automatisches Löschen oder Pruning ist
nicht implementiert und nicht aktiviert. Da B2 auch alte Objektversionen
aufbewahrt, kann das kostenlose Budget früher erreicht sein. RPO und RTO sind
erst nach den echten Läufen messbar, bislang gibt es keine zugesicherte
Wiederherstellungszeit. Mocktests, Budgettests, Storage-Tests, Syntax und Lint
sind erfolgreich. Produktiver Export und erneuter B2-Download sind belegt; der
isolierte Restore bleibt offen.
Ein kompletter
synthetischer PostgreSQL-Export und Restore auf einem kostenlosen Actions-Runner
ist inzwischen erfolgreich. Image-Initialisierung, Rollen, das JSON-Protokoll mit
mehreren Katalogeinträgen und der reale `pg_restore` wurden damit unabhängig von
Live-Zugangsdaten erprobt. Der genaue Nachweis steht weiter unten.

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

### Nächste Stufe: vollständige Anwendungsabnahme

Nach erfolgreichem synthetischem Datenbanktest und dem ersten echten
B2-Download-Restore wird die isolierte Probe erweitert:

1. Einen kurzlebigen lokalen Supabase-Stack auf dem kostenlosen Actions-Runner
   erstellen. API-Ports nur an Loopback binden. Ausgehenden Mailversand,
   Produktions-OAuth und Webhooks deaktivieren; externe Netzwerkziele sperren.
2. Den aus B2 geladenen Stand in diesen Stack übernehmen. Den Avatar-Constraint
   ausschließlich im isolierten Ziel auf die lokale Storage-Herkunft anpassen,
   alle Objektbytes über die lokale Storage-API wiederherstellen und erneut
   abrufen und hashen.
3. Ausschließlich dort synthetische Konten für die unveränderten Rollen anlegen.
   Anmeldung, Profil und Rollen-Gates über Auth- und REST-API prüfen. Keine
   Nachrichten an aus dem Backup übernommene Konten versenden.
4. Die Website mit lokalen Supabase-Zugangsdaten starten und FCB- sowie
   JFG-Preview testen. Tenant-Trennung, unzureichende Rollen und einen Avatar-
   Abruf im Browser prüfen. Testkonten dürfen nur das lokale Ziel verändern.
5. Nur zusammengefasste Ergebnisse veröffentlichen. Screenshots, Trace-Dateien,
   Dumps und Protokolle mit übernommenen Nutzerdaten nicht als Actions-Artefakte
   speichern. Stack, lokale Dateien und Testkonten danach entfernen.

Diese Stufe ist weiter Bestandteil des Auftrags und bleibt offen, bis die
konkreten API- und Browser-Läufe belegt sind. Ein erfolgreicher Datenbank-Teiltest
ersetzt sie nicht.

## E-Mail-Alarme und Error-Monitoring

Bestätigter Wunsch: E-Mail an Basti. Die Zustellung einer GitHub-Actions-Fehlermail
an sein verbundenes Postfach wurde für Schema-Replay am 13. November 2026 um
09:02:09 UTC nachgewiesen. Das belegt den allgemeinen Actions-E-Mail-Kanal.
Die gezielte Alarmprobe des Verfügbarkeitsworkflows und die Empfängerzuordnung
für dessen geplante Läufe werden getrennt geprüft. Die gezielte PR-Alarmprobe
wurde mit dem temporären Commit `3e8d9dc` ausgelöst: Lauf `43398573784` schlug
erwartet fehl, die zugehörige E-Mail kam um 09:07:12 UTC an. Die gleichzeitig
laufende CI `43398573776` war erfolgreich. Dabei wurde keine Produktionsseite
abgeschaltet. Die temporäre PR-Auslösung der Alarmprobe wurde vor dem Merge
zurückgenommen; im finalen Workflow bleibt sie ausschließlich manuell auslösbar.
Die Empfängerzuordnung eines geplanten Fehlerlaufs ist weiterhin nicht durch
diese PR-Probe belegt. Adressen und Nachrichteninhalte werden nicht im
öffentlichen Repository festgehalten.

| Zweck | Möglicher Weg | Voraussetzung und Grenze |
| --- | --- | --- |
| Ausfall beider Domains | UptimeRobot Free mit zwei aktiven HTTP-Monitoren im 5-Minuten-Intervall und E-Mailalarm | Beide Produktionsmonitore Up; echte Down-/Up-Alarmprobe samt empfangenen E-Mails erfolgreich, Testmonitor anschließend pausiert |
| HTTP-Prüfung aus diesem Repository | Echter PR-Lauf, manueller Main-Lauf und gezielte PR-Alarmmail erfolgreich geprüft | Zeitplanbetrieb und dessen Benachrichtigungszuordnung noch offen |
| Client- und Serverfehler | Sentry Developer, SDK auf Produktion und separate geschützte Prüfvorschau | Beide Fehlerwege, Regressionserkennung und Alarmmails in Vorschau nachgewiesen; Geo-Retest ohne gespeicherte Geo-Werte erfolgreich |
| Vercel-Anomaliealarme | Nicht vorgesehen | Kostenpflichtige Erweiterung und damit außerhalb des beauftragten Umfangs |

UptimeRobot Free überwacht beide Produktionsdomains unabhängig von GitHub Actions.
Beide HTTP-Monitore sind Up, prüfen alle fünf Minuten und haben aktive
E-Mailkontakte. Ein separater Testmonitor gegen eine absichtlich fehlende
Testseite erzeugte einen echten HTTP-404-Alarm. Die Down-Mail kam am 13.11.2026
um 16:48:01 UTC an. Nach Umstellung auf die erreichbare Startseite folgten der
aufgelöste Vorfall und die Up-Mail um 16:50:27 UTC. Der Testmonitor ist danach
pausiert. Drei von 50 kostenlosen Monitorplätzen sind belegt; keine bezahlten
Funktionen wurden aktiviert.

Sentry wurde in einer EU-Organisation mit dem Projekt `fcb-website`
(ID `4512424071790672`) eingerichtet. Der kostenlose Developer-Grundplan ist
bestätigt, es gibt kein Zahlungsmittel und keine Mehrverbrauchsabrechnung. Ein
geschenkter 14-Tage-Test ändert diese Vorgabe nicht und wird nicht kostenpflichtig
verlängert. Der Developer-Tarif nimmt nach Überschreiten seiner Quote keine
weiteren Ereignisse an, statt kostenpflichtig weiterzubuchen.

Unter Sentry **Settings → Legal** wird der Vertrag zur Auftragsverarbeitung
weiterhin als „Review and Accept“ angezeigt. Die Annahme durch den Betreiber
steht aus und ist keine erledigte Einrichtung. Die EU-Datenregion ist bestätigt;
die Freigaben zur Produktverbesserung mit identifizierenden Daten sind aus.

Die dokumentierte Aufbewahrung für Fehlerdaten beträgt im Developer-Tarif
30 Tage. Neue Sentry-Testphasen haben standardmäßig die Team-Aufbewahrung von
90 Tagen.
Die Frist wird beim Eingang eines Ereignisses festgelegt; ein späterer Wechsel
zum Developer-Tarif verkürzt ältere Testereignisse nicht rückwirkend. Session
Replay und Tracing bleiben aus. Die Fristen stammen aus der offiziellen
[Sentry-Dokumentation](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/).

Im Provider sind IP-Speicherung unterbunden, Standard- und Server-Scrubbing
aktiviert, JavaScript-Quellcode-Nachladen deaktiviert, TLS-Prüfung aktiviert und
der E-Mail-Präfix `FCB/JFG` gespeichert. Die Werte wurden nach Navigation erneut
geprüft. `NEXT_PUBLIC_SENTRY_DSN` ist für Vercel Production und Preview gesetzt,
Development bleibt aus. [PR #9](https://github.com/BastiiSP/fcb-website/pull/9)
ist als `0c186cfa6a6ee66642e70e345f59a0befc4a2cee` mit fünf erfolgreichen
Main-Prüfungen ausgeliefert. Das zugehörige Vercel-Produktionsdeployment ist
Ready; beide Domains wurden danach im Browser mit richtigem `data-tenant`,
Seitentitel und H1 geprüft.

Eine separate, durch Vercel-SSO geschützte Prüfvorschau hat echte synthetische
Client- und Serverfehler an Sentry übertragen. Nach der IP-Korrektur wurden die
zuvor als gelöst markierten Testissues erneut ausgelöst und als Regressionen
erkannt. Die zugehörigen Alarmmails sind am 13.11.2026 für den Client um
16:28:13 UTC und für den Server um 16:28:17 UTC im Empfängerpostfach nachgewiesen.
Dies belegt beide Fehlerwege, Regressionserkennung und Zustellung in der
Vorschau. Das SDK ist produktiv ausgeliefert; ein absichtlich ausgelöster
Produktionsfehler wurde nicht verwendet.

Die erneute JSON-Prüfung beider Ereignisse bestätigt
`sdk.settings.infer_ip=never`. `user` enthält nur Geo-Schlüssel, deren sämtliche
Werte `null` sind; gespeicherte Geo-Werte fehlen, `_meta` weist Redaction aus.
`request` und `extra` sind leer, Breadcrumbs fehlen, `contexts` enthält nur den
beim Ingest ergänzten Trace-Kontext. Die Provider-Regel für `user.geo` ist
gespeichert und geprüft. Ältere synthetische Testereignisse enthalten weiterhin
historische Geo-Werte und wurden nicht gelöscht. Dies waren keine
Produktionsereignisse. Privacy- und echte SDK-Envelope-Tests prüfen zusätzlich
den festen Relay-Schalter.

Der vorgesehene SDK-Umfang sind unbehandelte Fehler in Browser, Server und Edge.
Bereits abgefangene BFV-, HTTP- und Supabase-Fehler werden dadurch nicht umfassend
erfasst. Beispielsweise behandeln BFV-Abruf und Passwort-Leak-Proxy ihre Fehler
selbst. Die SDK-Einführung ist kein Nachweis, dass sämtliche Fehlerwege im
Monitoring ankommen.

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

## Synthetischer Wiederherstellungsnachweis

Der [erfolgreiche PostgreSQL-17-Prüflauf](https://github.com/BastiiSP/fcb-website/actions/runs/43417624819)
verwendet ausschließlich erfundene Daten. Er exportiert mit dem unveränderten
Sicherungsmodul aus einem netzwerkisolierten PostgreSQL-17-Container, verschlüsselt
den Export in einem lokalen restic-Repository, lädt ihn daraus erneut und prüft
die Wiederherstellung in einem zweiten Container mit `--network none`.
Tabellenstände, RLS-Policies, Funktionen, Trigger, Constraints, Grants, Sequenzen
und eine synthetische Storage-Datei wurden verglichen. Die Zeilenzahl der
synthetischen Quelltabelle blieb vor und nach dem Export unverändert.

Der echte Lauf hat drei im isolierten Restore korrigierte Fehler aufgedeckt:
fehlende lokale Passwortübergabe, zu frühe Bereitschaft am temporären
Initialisierungsserver und das Löschen des benötigten Standardschemas `public`.
Die endgültige Bereitschaft wird jetzt durch einen authentisierten TCP-SELECT
auf Loopback geprüft. Es werden keine Containerports veröffentlicht.

Der Prüfer `scripts/backup-synthetic.test.sh`, seine SQL-Fixture und der Workflow
`backup-synthetic.yml` bleiben reproduzierbar erhalten. Der Workflow lässt sich
manuell ausführen und reagiert automatisch ausschließlich auf den separaten
Testbranch `codex/backup-synthetic-proof`. Er benötigt keine Produktionssecrets
und hat keinen Zeitplan.

Dieser synthetische Nachweis umfasst weder B2 noch Supabase Auth, die Storage-API
oder Anwendungsabläufe. Der spätere produktive Export und erneute B2-Download
sind oben separat belegt. Dessen isolierter Restore sowie die vollständige
Rollen- und Tenant-Abnahme bleiben offen.

## Geprüfte SDK-Vorbereitung und bestehende Paketfunde

Die Sentry-Einführung mit SDK `11.12.0` wurde über
[PR #9](https://github.com/BastiiSP/fcb-website/pull/9) ausgeliefert. Privacy-Tests und
eine echte SDK-Probe mit In-Memory-Transport prüfen das Filtern synthetischer
vertraulicher Inhalte und Anhänge sowie den festen Relay-Schalter
`infer_ip=never`. Die frischen Pflichtprüfungen müssen am jeweiligen PR-Head
erfolgreich sein. Echte Vorschauereignisse, Regression-Alarmmails und die erneute
Datenschutzabnahme ohne gespeicherte Geo-Werte sind separat belegt. Die
Produktionsauslieferung und beide Tenant-Startseiten sind ebenfalls geprüft.
Temporäre Fehlerknöpfe und Testroute liegen ausschließlich auf einem separaten
Prüfbranch und wurden nicht nach `main` übernommen.

Die Datenschutzergänzung aus [PR #13](https://github.com/BastiiSP/fcb-website/pull/13)
ist als `7258ff1` produktiv. Beide `/datenschutz`-Seiten sind mit Stand November
2026, richtigem Verantwortlichen und den drei Betriebsabschnitten geprüft.
Sportheim erscheint nur bei FCB; beide Themes sind lesbar und wechseln ohne
horizontalen Überlauf. Alle fünf Main-Pflichtchecks waren erfolgreich.

Der erfolgreiche
[Auditvergleich](https://github.com/BastiiSP/fcb-website/actions/runs/43414322205)
meldet für `main` und den Sentry-Stand dieselben 19 Paketfunde: 11 moderate,
7 hohe und einen kritischen Fund. Bei Beschränkung auf Produktionsabhängigkeiten
bleiben 11 Paketfunde. Sentry hat in diesem Vergleich keine neuen Funde ergänzt.
Installiert ist Next.js `16.2.10`. Die geprüften GitHub-Advisories
[GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
und [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr)
nennen für Next.js 16 die Version `16.4.1` als gepatcht. Ihre Voraussetzungen
betreffen Bildoptimierung unter glibc/Linux beziehungsweise bestimmte
Cache-Components-Rückgaben. Die konkrete Ausnutzbarkeit dieser Anwendung wurde
nicht geprüft. Ein Upgrade wurde nicht durchgeführt und bleibt eine eigene
Aufgabe.

## Manuelle Prüfung

- `https://www.fcbuku.de/datenschutz` öffnen → Stand November 2026 und Abschnitte
  Sentry, UptimeRobot und Sicherungskopien prüfen → FCB ist als
  Verantwortlicher angegeben, Sportheim-Anfrage ist enthalten; Fehlermerkmale:
  JFG-Verantwortlicher, fehlender Abschnitt oder behaupteter erfolgreicher Restore.
- `https://www.jfg-kunstadt-obermain.de/datenschutz` öffnen → dieselben
  Betriebsabschnitte prüfen → JFG ist als Verantwortlicher angegeben,
  Sportheim-Anfrage fehlt; Fehlermerkmale: FCB-Verantwortlicher oder
  Sportheim-Formularabschnitt auf der JFG-Seite.
- Auf beiden Datenschutzseiten im Footer jeweils helles und dunkles Theme
  einstellen und Quellenlinks per Tab fokussieren → Text bleibt lesbar und
  Fokus sichtbar, Links öffnen die richtigen Quellen; Fehlermerkmale:
  Kontrastverlust, abgeschnittener Text, fehlender Fokus oder defekter Link.
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
- Sentry → Settings → Legal öffnen und Vertragsstatus prüfen → Annahme durch den
  Betreiber dokumentiert; Fehlermerkmal: weiterhin „Review and Accept“.
- GitHub Actions → „Vorhandene Sicherung isoliert wiederherstellen“ auf `main`
  manuell starten → vorhandener B2-Stand wird ohne Quellzugriff geladen, Projekt,
  Image und Archiv geprüft, dann isoliert wiederhergestellt; Fehlermerkmale:
  mehrdeutiger Snapshot, fremdes Projekt, Fehlerphase oder fehlendes Cleanup.
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
- [Backblaze B2: Kostenlimits](https://www.backblaze.com/docs/cloud-storage-data-caps-and-alerts)
- [Sentry: Developer-Tarif](https://sentry.io/pricing/)
- [Sentry: Aufbewahrungsfristen](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/)
- [Sentry: Keine Mehrverbrauchsabrechnung im Developer-Tarif](https://www.sentry.help/en/articles/13965037-can-i-set-up-an-on-demand-pay-as-you-go-budget-for-my-free-developer-plan)
- [Vercel: Alerts](https://vercel.com/docs/alerts)
- [UptimeRobot: Tarife](https://uptimerobot.com/pricing/)
- [Sentry: Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [GitHub: Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub: Benachrichtigungen für Workflow-Läufe](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- [GitHub: Actions-Benachrichtigungen einstellen](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
