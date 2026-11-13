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
| Öffentliche HTTP-Prüfung | Beide Domains liefern HTTP 200 und den richtigen Tenant | Erfolgreicher PR-#8-Lauf `43398257499`, Job `131794400503` |
| GitHub-Fehlermail | Allgemeine und gezielte Verfügbarkeits-Alarmmail an Basti zugestellt | Schema-Replay am 13.11.2026 um 09:02:09 UTC, Commit `964787d`; Verfügbarkeits-Alarmprobe um 09:07:12 UTC, Commit `3e8d9dc`, Lauf `43398573784` |
| Laufzeit-Alarmierung | Kein zugestellter Laufzeitfehleralarm nachgewiesen | Observability Plus laut API nicht aktiviert; Integrationsliste mangels Berechtigung nicht einsehbar |
| Sentry | EU-Projekt eingerichtet, kostenloser Developer-Grundplan ohne Zahlungsmittel | Datenschutz-Einstellungen gespeichert und erneut gelesen; SDK-Einführung separat in Arbeit, Ereignis und Alarmmail noch nicht belegt |

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
Der PR-#8-Lauf `43398257499` hat beide echten Produktionsanfragen erfolgreich
geprüft: HTTP 200 und passender Tenant. Der Zeitplan gilt erst nach Übernahme auf
den Standardbranch und einem belegten geplanten Actions-Lauf als aktiv.
GitHub bietet für Zeitpläne keine
garantierte Startzeit; Läufe können sich verzögern oder entfallen. Bei öffentlichen
Repositories werden Zeitpläne nach 60 Tagen ohne Repository-Aktivität deaktiviert.
Bis 13.11.2026 um 10:54 UTC war noch kein geplanter Lauf sichtbar. Der
Zeitplanbetrieb bleibt deshalb offen. Der E-Mail-Kanal für kontrollierte
PR-Fehler ist belegt, das Routing geplanter Fehler bleibt separat zu prüfen.

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
| Backup-Bucket | privat, leer, EU Central, serverseitige Verschlüsselung aktiv |
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

Die vier Repository-Secrets `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_KEY_ID` und `BACKUP_S3_KEY` sind hinterlegt; ihre Namen wurden in der
GitHub-Oberfläche geprüft. Datenbankzugang, Storage-Schlüssel und
restic-Passwort fehlen weiterhin. Nach erneuter Prüfung der kostenlosen
Anbieter-Caps und der fehlenden Zahlungsweise ist die Repository-Variable
`BACKUP_FREE_TIER_CONFIRMED=true` gesetzt. `BACKUP_ENABLED` fehlt weiterhin,
Environment-Variablen sind leer. Der Sicherungszeitplan bleibt damit gesperrt.
Es wurden keine vollständigen Produktionsdaten gesichert und kein echter
B2-Download-Restore durchgeführt. Bucket und Schlüssel allein sind kein
Backup-Nachweis.

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
keine Repository-Variable und aktiviert keinen Zeitplan. Der Helfer wurde nur
mit erfundenen Schlüsseln und einem GitHub-Mock getestet, nicht zur echten
Übertragung ausgeführt.

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

Nach Kontoprüfung die Repository-Variable `BACKUP_FREE_TIER_CONFIRMED=true`
setzen. `BACKUP_ENABLED` bleibt zunächst aus. Zuerst den manuellen Modus
`preflight` erfolgreich prüfen. Erst mit vollständigen Zugangsdaten den Modus
`backup` ausführen, beim ersten Mal `initialize_repository=true` und
`verify_restore=true`. Initialisieren ist nur bei vollständig leerem Bucket
erlaubt, einschließlich alter Versionen und Löschmarkierungen.

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
GitHub Actions prüft das TLS-Serverzertifikat mit `verify-full` und System-CAs.
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
sind erfolgreich, ein echter API-Lauf mit Zugangsdaten bleibt offen. Ein kompletter
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
| Ausfall beider Domains | Externer HTTP-Monitor, etwa UptimeRobot Free | Konto, bestätigte E-Mail; zum Prüfzeitpunkt kostenlose HTTP-Prüfung alle 5 Minuten laut Anbieter |
| HTTP-Prüfung aus diesem Repository | GitHub-Actions-Lauf mit `http-probe.mjs`, echter PR-Lauf und gezielte Alarmmail erfolgreich geprüft | Zeitplanbetrieb und dessen Benachrichtigungszuordnung noch offen; Zeitplan kann verzögert laufen |
| Client- und Serverfehler | Sentry Developer, EU-Projekt eingerichtet | SDK-Einführung in Arbeit; echtes Ereignis, Datenschutzabnahme und zugehörige E-Mail noch offen |
| Vercel-Anomaliealarme | Nicht vorgesehen | Kostenpflichtige Erweiterung und damit außerhalb des beauftragten Umfangs |

Sentry wurde in einer EU-Organisation mit dem Projekt `fcb-website`
(ID `4512424071790672`) eingerichtet. Der kostenlose Developer-Grundplan ist
bestätigt, es gibt kein Zahlungsmittel und keine Mehrverbrauchsabrechnung. Ein
geschenkter 14-Tage-Test ändert diese Vorgabe nicht und wird nicht kostenpflichtig
verlängert. Der Developer-Tarif nimmt nach Überschreiten seiner Quote keine
weiteren Ereignisse an, statt kostenpflichtig weiterzubuchen.

Im Provider wurden IP-Speicherung verhindert, Standard- und Server-Scrubbing
aktiviert, JavaScript-Quellcode-Nachladen deaktiviert, TLS-Prüfung aktiviert und
der E-Mail-Präfix `FCB/JFG` gespeichert. Die Werte wurden nach Navigation erneut
geprüft. Ein Sentry-Ereignis oder eine zugehörige E-Mail wurde noch nicht
nachgewiesen. Für Vercel-Umgebungsvariablen reicht die derzeitige Connector-
Berechtigung nicht aus, die CLI ist nicht vorhanden; die Provider-Anmeldung
bleibt dafür erforderlich.

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

Dieser Nachweis umfasst weder B2 noch Supabase Auth, die Storage-API oder
Anwendungsabläufe. Ein produktives verschlüsseltes B2-Backup samt erneutem
Download und Restore sowie die vollständige Rollen- und Tenant-Abnahme bleiben
offen. Es wurden keine Produktionsdaten exportiert.

## Geprüfte SDK-Vorbereitung und bestehende Paketfunde

Die Sentry-Einführung mit SDK `11.12.0` liegt in
[Entwurf PR #9](https://github.com/BastiiSP/fcb-website/pull/9), Stand
`ffa1d5cc8f0eb2158e23f74ecc5bc9e5c11de3ca`. Alle fünf Pflichtprüfungen
sind erfolgreich. 39 Unit-Tests einschließlich einer echten SDK-Probe mit
In-Memory-Transport prüfen das Filtern synthetischer vertraulicher Inhalte und
Anhänge. Das belegt weder die Zustellung an Sentry noch eine Alarm-E-Mail.
Echte Vorschauereignisse aus Browser und Server sowie die empfangenen Alarmmails
bleiben offen. Die Änderung ist noch nicht gemergt.

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
- [Backblaze B2: Kostenlimits](https://www.backblaze.com/docs/cloud-storage-data-caps-and-alerts)
- [Sentry: Developer-Tarif](https://sentry.io/pricing/)
- [Sentry: Keine Mehrverbrauchsabrechnung im Developer-Tarif](https://www.sentry.help/en/articles/13965037-can-i-set-up-an-on-demand-pay-as-you-go-budget-for-my-free-developer-plan)
- [Vercel: Alerts](https://vercel.com/docs/alerts)
- [UptimeRobot: Tarife](https://uptimerobot.com/pricing/)
- [Sentry: Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [GitHub: Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub: Benachrichtigungen für Workflow-Läufe](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- [GitHub: Actions-Benachrichtigungen einstellen](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
