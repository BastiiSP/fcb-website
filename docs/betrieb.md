# Betrieb, Sicherung und Alarmierung

Stand: 13. November 2026. Belegte Zustände und verbleibende Prüfgrenzen.
Eine Migrationshistorie ersetzt keine Datensicherung, ein erfolgreicher
Datenbank-Restore noch keine Anwendungsabnahme.

## Eingesetzte Dienste

| Dienst | Aufgabe | Belegter Stand und Kostenrahmen |
| --- | --- | --- |
| GitHub | Repository, Pull Requests, CI, Schema-Replay, Sicherungsworkflows | `main` geschützt, fünf Pflichtchecks; öffentliche Standardrunner. [Entwicklungsprozess](entwicklungsprozess.md) |
| Vercel | Gemeinsame Anwendung für FCB und JFG | Beide Domains produktiv; kein kostenpflichtiges Observability Plus |
| Supabase | PostgreSQL 17, Auth und Storage | Free-Projekt; 27 Migrationen abgeglichen, 130 isolierte Prüfungen; kostenpflichtiges natives Preview-Branching deaktiviert. [Migrationsabgleich](supabase-migration-abgleich.md) |
| Backblaze B2 | Verschlüsseltes externes Sicherungsziel | EU Central, privat, kein Zahlungsmittel, 0-Dollar-Caps; Export und isolierter Datenbank-/Dateirestore belegt |
| Sentry | Unbehandelte Client-, Server- und Edge-Fehler, E-Mailalarme | EU-Projekt, Developer-Grundplan mit befristetem Test; SDK produktiv, Testfehler und Alarmzustellung belegt; DPA-Annahme offen |
| UptimeRobot | Externe Erreichbarkeit beider Domains | Free, zwei aktive HTTP-Monitore alle fünf Minuten; Down-/Up-E-Mails belegt; Testmonitor pausiert |

## Aktueller Nachweis

| Prüfung | Ergebnis | Nachweis oder Grenze |
| --- | --- | --- |
| Produktionsauftritte | Beide Marken mit HTTP 200 und richtigem Tenant erreichbar | Geplanter [HTTP-Lauf 43521509487](https://github.com/BastiiSP/fcb-website/actions/runs/43521509487) auf `fb8fe731`, Messung 13.11.2026 um 22:43:05 UTC. Start- und Datenschutzseiten beider Marken in beiden Themes visuell geprüft; JFG nach Neuladen ohne Sportheim-Text |
| Verschlüsseltes Backup | Aktueller regulärer Export und B2-Upload erfolgreich | [Lauf 43486494378](https://github.com/BastiiSP/fcb-website/actions/runs/43486494378) auf `e0a82c8`; exakte neue Snapshot-ID, keine erneute Initialisierung |
| Datenbank-/Dateirestore | Im selben regulären Lauf: erneuter B2-Download, SHA-256, Archiv, Import, Tabellen, RLS, Policies, Katalog und Storage-Dateien erfolgreich | [Lauf 43486494378](https://github.com/BastiiSP/fcb-website/actions/runs/43486494378); sämtliche Schritte und Cleanup erfolgreich |
| App-Vorprüfung | Helpertests einschließlich echtem Gateway-TLS und öffentlicher App-Build erfolgreich | [Lauf 43482402751](https://github.com/BastiiSP/fcb-website/actions/runs/43482402751), PR #18; ausschließlich synthetische Vorbereitung |
| Anwendungsprobe | Storage-/Auth-API, Rollen- und Tenant-Prüfung sowie zwei Browserfälle erfolgreich | [Lauf 43483076155](https://github.com/BastiiSP/fcb-website/actions/runs/43483076155) auf `ec0322e` mit `verify_application=true`; Cleanup erfolgreich |
| Sicherungszeitplan | Täglich 03:27 UTC aktiviert, erstes Fenster noch nicht erreicht | Beide Flags am 13.11.2026 gegen 18:35 UTC zurückgelesen; erster Termin danach 14.11.2026 um 03:27 UTC (04:27 Uhr Berlin). Actions-Abfrage am 13.11.2026 um 22:48 UTC: kein Sicherungslauf mit `event=schedule` |

Die beauftragte Anwendungsprobe umfasst alle gesicherten Dateien über lokale
Storage-API mit erneutem Download und Byte-/SHA-256-Vergleich, sieben synthetische
Auth-Konten, REST-Profile, Tenant-Trennung, Rollenänderungsschutz und eigene/fremde
Trainerbuchungen. Die Browserfälle prüfen FCB/ausstehend und JFG/mitglied samt
Rollenhinweisen und lokalem Avatar-Abruf mit Hashvergleich. Das ist kein eigener
visueller Profilbildtest und keine pauschale Abnahme aller Anwendungsabläufe.

Der bestätigte Storage-Ausgangsbestand umfasst den öffentlichen Bucket `avatars`
(Typ `STANDARD`) mit vier Objekten und insgesamt 96.391 Byte. Dateiinhalte werden
zusätzlich zum Datenbankexport gesichert. `file_size_limit` und
`allowed_mime_types` waren bei der Metadatenprüfung jeweils `null`.

## Kostenrahmen und Zugänge

Verbindlich: keine privaten Kosten. Keine Zahlungsmittel, bezahlten Tarife,
Mehrverbrauchsabrechnung oder kostenpflichtigen Runner aktivieren.

Das B2-Konto liegt in EU Central; E-Mail und Zwei-Faktor-Anmeldung sind bestätigt,
Business Groups aus. Die Kontoseite zeigte 0 Dollar und keine Zahlungsweise.

| Einstellung | Bestätigter Wert |
| --- | --- |
| Speicher | 0 Dollar, maximal 10 GB |
| Download | 0 Dollar, maximal 1 GB pro Tag |
| Class B und C | jeweils maximal 2.500 Vorgänge pro Tag |
| E-Mail-Warnungen | aktiv |
| Backup-Bucket | privat, serverseitig verschlüsselt; restic-Repository initialisiert |
| Objektversionen | alle Versionen behalten; Object Lock aus |
| Event Notifications und Replikation | nicht eingerichtet |

Diese Caps stammen aus dem Konto und sind nicht durch die S3-API vollständig
prüfbar. Class D hat beim Anbieter kein Kostenlimit und wird nicht verwendet.
Der bestehende bucketgebundene UI-Schlüssel „Read and Write“ mit
`listAllBucketNames` erlaubt auch Bucket-Konfigurationsänderungen. Er ist daher
kein minimaler Objektschlüssel; der Backupcode nutzt diese Zusatzrechte nicht.
Keine Präfixbeschränkung verwenden, die alte Versionen aus der Budgetprüfung
versteckt. Bestehende Kontoeinstellungen vor weiterem Betrieb bestätigen.

Alle zehn Backup-Secrets sind hinterlegt; Werte werden nicht veröffentlicht.
`BACKUP_FREE_TIER_CONFIRMED=true` bestätigt den geprüften kostenlosen Rahmen.

| GitHub-Secret | Inhalt |
| --- | --- |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET` | bestätigter HTTPS-Endpunkt und privater Bucket |
| `BACKUP_S3_KEY_ID`, `BACKUP_S3_KEY` | bestehender bucketgebundener B2-Anwendungsschlüssel |
| `BACKUP_RESTIC_PASSWORD` | starkes Passwort mit mindestens 32 Zeichen; getrennte sichere Wiederherstellungskopie erforderlich |
| `BACKUP_DB_HOST`, `BACKUP_DB_PORT`, `BACKUP_DB_USER` | offizielle direkte Verbindung oder Session-Pooler |
| `BACKUP_DB_PASSWORD` | bestehendes Datenbankpasswort; nicht für Sicherungsarbeiten zurücksetzen |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | serverseitiger Schlüssel für lesenden Storage-Export |

`postgres` und `service_role` erlauben technisch mehr als Lesen. Der geprüfte
Exporter verwendet sie ausschließlich lesend. Workflow-Änderungen sind deshalb
besonders zu begrenzen; produktive Zugänge werden nicht in Restore-Container
übernommen. Der reine Restore benötigt nur die vier B2-Secrets und das
restic-Passwort, keine Datenbank- oder Supabase-Service-Zugänge.

Der geprüfte Terminalhelfer überträgt Werte verdeckt über Standardeingabe an
GitHub, ohne Repository-Variablen oder Zeitpläne zu setzen:

```sh
bash scripts/configure-backup-secrets.sh
bash scripts/configure-backup-secrets.sh --preserve-existing-b2
```

Der zweite Modus erhält die vier vorhandenen B2-Secrets und überträgt nur die
sechs übrigen Werte. Er prüft Secret-Namen, kann gespeicherte Werte nicht lesen.
PTY-Mocktests decken beide Modi, fehlende Namen und Terminalbereinigung ab.

## Sicherung und Wiederherstellung bedienen

| Workflow | Verwendung | Grenze |
| --- | --- | --- |
| [backup.yml](../.github/workflows/backup.yml) | `preflight`: B2/Budget; `backup`: Quelle lesen, verschlüsseln und sichern | manuell nur `main`; geplante Läufe benötigen `BACKUP_ENABLED=true` |
| [backup-restore.yml](../.github/workflows/backup-restore.yml) | vorhandenen eindeutigen neuesten B2-Stand erneut prüfen | manuell nur `main`; kein Init, kein neuer Export |
| [restore-app-tests.yml](../.github/workflows/restore-app-tests.yml) | öffentliche Helper-/TLS- und Prepare-/Build-Vorprüfung | keine Secrets oder Backupdaten; ersetzt keinen echten App-Lauf |
| [restore-infrastructure.yml](../.github/workflows/restore-infrastructure.yml) | synthetische Netzprobe und öffentliche Image-Auflösung | Tags nur für diesen Resolver; echte Restores verwenden feste Digests |

Der Export übergibt ausschließlich die vollständige ID aus der erfolgreichen
restic-JSON-Summary über eine private Ergebnisdatei an den Restore. Eine globale
`--latest`-Auswahl wird dafür nicht verwendet; wechselnde temporäre Payloadpfade
waren damit kein eindeutiger Nachweis des gerade erzeugten Stands.

Die einmalige Repository-Initialisierung ist abgeschlossen. Niemals erneut
`initialize_repository=true` verwenden. Weitere Wiederherstellungsproben
verwenden den vorhandenen Stand, ohne Datenbank oder Supabase Storage neu zu
lesen. Der [B2-Preflight 43461145123](https://github.com/BastiiSP/fcb-website/actions/runs/43461145123)
belegt Zugang und Budgetprüfung getrennt vom tatsächlichen Export.

Im Restore-only-Dialog bleibt `verify_application` standardmäßig aus. Bei
explizitem `true` werden gepinnte öffentliche Images und ein minimaler App-Build
vor B2-Secrets und Download vorbereitet. Frische Testschlüssel bleiben in einer
privaten Datei. Erst nach dem unveränderten Datenbank-/Dateivergleich startet
die optionale Anwendungsprobe. Der Workflow bereinigt App-Images und private
Dateien auch nach Fehlern. Beide Datenworkflows teilen eine Concurrency-Sperre.

Der tägliche Export um 03:27 UTC ist aktiviert. Das erste Zeitfenster nach der
Aktivierung ist am 14.11.2026 um 03:27 UTC (04:27 Uhr Berlin); bei der Prüfung
am 13.11.2026 um 22:48 UTC lag noch kein geplanter Sicherungslauf vor. Der
erfolgreiche Lauf `43486494378` wurde manuell ausgelöst (`workflow_dispatch`).
Am ersten Monatstag folgt ein zusätzlicher Download mit isoliertem
Datenbank-/Dateirestore. Die vollständige App-Probe ist
separat manuell auszuführen. GitHub-Zeitpläne haben keine garantierte Startzeit,
können ausbleiben und werden bei öffentlichen Repositories nach 60 Tagen ohne
Aktivität deaktiviert. Tatsächlichen geplanten Lauf und Empfängerzuordnung
nach der Aktivierung gesondert nachweisen.

### Exportvertrag und Budget

`backup-create.sh` verwendet eine lesende Repeatable-Read-Transaktion mit
exportiertem PostgreSQL-Snapshot. Dump und Tabellenmanifest nutzen denselben
Stand. Enthalten sind Custom-Archiv, Auth-/Geschäftsdaten, Storage-Metadaten,
Eigentümer, RLS, Funktionen, Trigger, Grants sowie Rollen und Mitgliedschaften
ohne Passwörter. Export und Restore verwenden denselben verifizierten PostgreSQL-Digest
`supabase/postgres@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426`.
Er wird vor Quellenzugriff exakt geprüft und im Manifest festgehalten. Vault-Secrets benötigen einen eigenen Wiederherstellungsvertrag;
sobald solche vorhanden sind, bricht der Export ab.

`default_transaction_read_only=on` schützt den Quellenzugriff. TLS und Hostname
werden mit `verify-full` und der offiziellen versionierten Supabase-CA geprüft:
`scripts/certificates/supabase-prod-ca-2021.crt`, SHA-256
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
CA-Prüfung und schreibgeschützter Container-Mount sind belegt. Ursache der
früheren TLS-Fehler waren unzureichende System-CAs; Nachweise:
[TLS-Eingrenzung](https://github.com/BastiiSP/fcb-website/actions/runs/43472243295),
[finale TLS-/Wrapperprobe](https://github.com/BastiiSP/fcb-website/actions/runs/43474759960).

Storage wird vor dem Dump und nach Downloads inventarisiert. Unterschiede in
Bucket-Einstellungen, Objektidentität, Metadaten oder Größen stoppen den Upload.
DB und Storage bilden dennoch keinen atomaren gemeinsamen Zeitpunkt; kurze
Zwischenänderungen und nicht MVCC-konsistente Sequenzstände bleiben eine Grenze.

Vor jedem Upload zählt die Budgetprüfung sämtliche sichtbaren B2-Versionen.
Multipart-Uploads oder mehr als ein sichtbarer Bucket stoppen den Lauf. Maximal
100 MB Payload; Bestand plus dreifache Payload-Größe plus 128 MB Reserve muss
unter 8 GB bleiben. Am Limit wird abgebrochen, kein Anbieterlimit angehoben.
`restic` verschlüsselt vor dem Upload. Auf dem kurzlebigen Runner liegen Daten
vorher in einem privaten Verzeichnis. Keine Dumps, Dateien, Metadaten oder
Diagnosen werden als Actions-Artefakte veröffentlicht; Verzeichnisse werden am
Ende entfernt. Das belegt keine sichere Löschung kompromittierter Datenträger.

Automatisches Löschen/Pruning ist nicht implementiert; sämtliche alten
B2-Versionen zählen zum Budget. Das folgende Aufbewahrungskonzept ist noch
nicht freigegeben oder ausgeführt. Es gibt keine zugesicherte RPO oder RTO.
Die beauftragte Anwendungsprobe ist belegt; die erste tatsächliche geplante
Sicherung steht noch aus.

### Aufbewahrung vorbereiten

Vorschlag: den jeweils jüngsten Stand aus sieben Tagen, vier Wochen und sechs
Monaten mit vorhandenen Sicherungen behalten. Die Gruppen überlappen; daraus
folgen weder genau 17 Stände noch bei Ausfällen sechs lückenlose Kalendermonate.
Zunächst ausschließlich lesend Snapshots, Host/Tags, Payloadpfade, alle
B2-Versionen und Löschmarker, physische Bytes, Lifecycle und Caps inventarisieren.
Die wechselnden temporären Payloadpfade erfordern eine bewusste Gruppierung.
Erst nach geprüfter Inventur wäre diese Vorschau sinnvoll:

```sh
restic forget --dry-run --json --host fcb-website --tag fcb-backup --group-by host --keep-daily 7 --keep-weekly 4 --keep-monthly 6
```

B2 über S3 behält mit „alle Versionen behalten“ auch durch `prune` versteckte
Dateien; dadurch wird noch kein physischer Speicher frei. Als separat
freizugebender Lifecycle-Vorschlag käme nur der Repository-Präfix `fcb-website/`
mit Löschung sieben Tage nach dem Verstecken infrage, ohne altersbedingtes
Verstecken aktueller Objekte oder überlappende Regeln. Der Anbieter verarbeitet
Regeln täglich; das ist kein exakt siebentägiger Löschtermin.

Vor echten Löschungen, `forget`, `prune` oder einer Lifecycle-Änderung sind die
konkret entfallenden Stände, verbleibenden Wiederherstellungsmöglichkeiten und
ein aktueller Restorebeleg vorzulegen und durch den Betreiber freizugeben.
Temporärer Platzbedarf, Downloads und API-Aufrufe von `prune` müssen innerhalb
der bestehenden Caps bleiben. Einsparungen zählen erst nach tatsächlichem
Versionsabbau; 8-GB-Grenze und Budgetformel werden nicht gelockert.

### Wiederherstellungsvertrag

`restore-verify.sh` lädt den konkreten Snapshot aus B2 erneut, prüft SHA-256 und
Archivlesbarkeit. Der Restore-only-Workflow akzeptiert nur einen eindeutigen
neuesten Snapshot mit Host `fcb-website`, Tag `fcb-backup`, Payload, bestätigtem
Projekt und festem PostgreSQL-Image. Er bietet kein frei wählbares Restore-Ziel.

`restore-isolated.mjs` erstellt einen neuen PostgreSQL-17-Container mit
`--network none`, ohne veröffentlichte Ports, SMTP, OAuth oder Webhooks.
Fehlende Rollen werden ohne LOGIN und produktive Passwörter angelegt. Nach
Import werden Tabellenstände, RLS, Policies, Funktionen, Trigger, Constraints,
Grants und Sequenzen vollständig verglichen. Export und Prüfer verwenden
identischen Metadaten-Suchpfad `public, extensions`; [PR #16](https://github.com/BastiiSP/fcb-website/pull/16)
beseitigt damit Darstellungsunterschiede, ohne Vergleiche abzuschwächen.
Storage-Bytes werden gehasht, separat materialisiert und ihren DB-Metadaten
zugeordnet. Der kurzlebige Container wird entfernt.

Der erfolgreiche echte Datenbank-/Dateirestore ersetzt weder Auth-/Storage-API
noch Browser-Rollen-/Tenant-Prüfung. Dafür verwendet die optionale App-Probe
nur den geprüften isolierten Bestand, lokale Schlüssel und synthetische Konten.
Sie teilt ausschließlich Loopback mit dem netzlosen Anker und prüft Host-,
IPv4-/IPv6- und DNS-Abschirmung. Die reine Infrastruktur ist durch
[43480328347](https://github.com/BastiiSP/fcb-website/actions/runs/43480328347)
belegt; der erfolgreiche tatsächliche App-Lauf ist oben separat nachgewiesen. Plattformkonfiguration,
externe Dienste und produktive Rollenpasswörter gehören nicht zum Restore.

Der frühere [synthetische PostgreSQL-17-Nachweis](https://github.com/BastiiSP/fcb-website/actions/runs/43417624819)
bleibt über `backup-synthetic.test.sh`, Fixture und Workflow reproduzierbar.
Er benötigt keine Produktionssecrets, hat keinen Zeitplan und belegt getrennt
Export, Verschlüsselung und Restore mit erfundenen Daten.

## Erreichbarkeit und E-Mailalarme

UptimeRobot überwacht beide Produktionsdomains unabhängig von GitHub Actions
alle fünf Minuten mit aktiven E-Mailkontakten. Ein separater HTTP-404-Testmonitor
belegte Down-Mail am 13.11.2026 um 16:48:01 UTC und nach Rückstellung Up-Mail um
16:50:27 UTC. Er ist jetzt pausiert. Drei von 50 kostenlosen Plätzen sind belegt.
Keine Produktionsseite wurde für die Alarmprobe abgeschaltet.

Der ergänzende Prüfer ist reproduzierbar:

```sh
node scripts/http-probe.mjs
node --test scripts/http-probe.test.mjs
```

Er erwartet je Domain direkten HTTP-200-HTML-Inhalt mit richtigem `data-tenant`;
Weiterleitungen sind Fehler. Pro Anfrage gelten 20 Sekunden und 2 MiB. Ausgaben
enthalten nur Prüfzeit, Tenant, Ergebnis, festen Fehlercode, Status und Dauer.
Die Probe belegt DNS/TLS/HTTP und Marke, keine Anmeldung, JavaScript oder BFV.
Der Workflow `availability.yml` ist auf `main` aktiv. Die geplanten Läufe
[43471758781](https://github.com/BastiiSP/fcb-website/actions/runs/43471758781)
(13.11.2026, 17:20:05 UTC) und
[43521509487](https://github.com/BastiiSP/fcb-website/actions/runs/43521509487)
(22:42:51 UTC) sind mit `event=schedule` und `success` belegt. Beim jüngeren
Lauf waren sechs Helpertests und beide HTTP-/Tenant-Prüfungen erfolgreich;
die kontrollierte Alarmprobe war erwartungsgemäß übersprungen. Die wenigen
beobachteten Läufe belegen kein durchgehend eingehaltenes Zehn-Minuten-Intervall.
UptimeRobot bleibt der unabhängige Verfügbarkeitsmonitor.

GitHub-Fehlermailzustellung ist durch Schema-Replay sowie die gezielte
[Verfügbarkeits-Alarmprobe 43398573784](https://github.com/BastiiSP/fcb-website/actions/runs/43398573784)
belegt. Die Fehlermail zum ersten [Backupversuch 43465773099](https://github.com/BastiiSP/fcb-website/actions/runs/43465773099)
kam am 13.11.2026 um 16:47:07 UTC an. Das belegt die manuelle Main-Zustellung,
noch nicht spätere Zeitplanalarme. Adressen/Nachrichteninhalte bleiben privat.

Für eine erneute gezielte GitHub-Probe `availability.yml` auf `main` zunächst
normal, dann mit `test_alert=true` ausführen und eingegangene E-Mail eindeutig
zuordnen. Danach wieder normal erfolgreich ausführen. Bei Zeitplänen richtet
GitHub Benachrichtigungen an Ersteller, letzten Cron-Bearbeiter oder
Wiederaktivierer. Bei beiden geplanten HTTP-Läufen meldet GitHub
`actor=triggering_actor=BastiiSP`. Das belegt die Ausführung unter dem
Betreiberkonto, aber keine E-Mail-Einstellung oder Zustellung für Zeitplanfehler.
Diese Empfängerprüfung bleibt offen. Ein manueller E-Mailtest ersetzt sie nicht.
Wiederherstellungsmails nicht ungeprüft voraussetzen.

## Sentry

Das EU-Projekt `fcb-website` ist im Developer-Grundplan ohne Zahlungsmittel und
Mehrverbrauchsabrechnung eingerichtet. Der geschenkte 14-Tage-Test wird nicht
kostenpflichtig verlängert. Im Developer-Tarif werden nach Quotenausschöpfung
keine weiteren Ereignisse angenommen. E-Mailalarme brauchen kein bezahltes
Upgrade. Vercel Observability Plus ist nicht aktiviert.

Unter **Settings → Legal** steht bei der erneuten Kontoprüfung weiterhin
„Review and Accept“ für DPA 5.1.0 vom 29.05.2024. Der Betreiber muss zunächst
Vertragszuordnung und Vertretungsberechtigung klären und den Vertrag dann
prüfen und annehmen. EU-Datenregion ist bestätigt; Freigaben zur
Produktverbesserung mit identifizierenden Daten sind aus. Die Vertragsannahme
ist weiterhin offen.

Fehlerereignisse stehen im Developer-Tarif 30 Tage, in neuen Testphasen
standardmäßig 90 Tage zur Verfügung. Der Tarif beim Ereigniseingang bestimmt die Frist;
späterer Tarifwechsel verkürzt ältere Ereignisse nicht rückwirkend.

Das SDK aus [PR #9](https://github.com/BastiiSP/fcb-website/pull/9) ist produktiv.
`NEXT_PUBLIC_SENTRY_DSN` ist für Production und Preview gesetzt, Development aus.
IP-Speicherung, Replay und Tracing sind aus, Scrubbing und TLS-Prüfung aktiv,
JavaScript-Quellcode-Nachladen aus. SDK-Privacy- und echte Envelope-Tests prüfen
Filterung und `infer_ip=never`.

Echte synthetische Client-/Serverfehler aus geschützter Vorschau und Regressionen
sind samt E-Mails am 13.11.2026 um 16:28:13 beziehungsweise 16:28:17 UTC belegt.
Der Geo-Retest enthält keine gespeicherten Geo-Werte; Request/Extra sind leer,
Breadcrumbs fehlen. Provider-Regel für `user.geo` ist gespeichert. Ältere
synthetische Testereignisse können historische Geo-Werte enthalten.
Temporäre Fehlerknöpfe und Testroute wurden nicht nach `main` übernommen.

Erfasst werden unbehandelte Fehler. Bereits abgefangene BFV-, HTTP- und
Supabase-Fehler kommen dadurch nicht umfassend an. Fehlermeldungen, URLs,
Header und Inhalte müssen vor bewusster zusätzlicher Erfassung gefiltert werden.

Die Datenschutzseite beschreibt die erstellte manuelle Sicherung, den
aktivierten täglichen Zeitplan, den noch ausstehenden ersten Cron-Lauf und die
erfolgreiche isolierte Wiederherstellungsprüfung. Verantwortlicher und
Sportheim-Abschnitt bleiben tenantabhängig. Beide Marken und Themes wurden auf
dem ausgelieferten Stand `fb8fe731` geprüft;
JFG enthält nach Neuladen keine Sportheim-Teilsätze, FCB enthält sie. Das
Vercel-Produktionsdeployment zu diesem Commit ist `READY`. Die Prüfung nach
Auslieferung neuer Änderungen bleibt mit den unten stehenden Schritten nötig.

## Sicherheitswartung

Im aktuellen Arbeitsstand sind Next.js auf `16.4.5` und `sharp` auf `0.35.5`
aktualisiert. Auf diesem Update-Branch bestanden lokal Lint (eine bestehende
Warnung), TypeScript einschließlich Typegen, 39 Unit-Tests, Produktionsbuild
und 19 Tenant-/Datenschutz-E2E-Fälle. Vor PR-Einreichung lokal geprüft;
CI- und Auslieferungsnachweise werden im zugehörigen Sicherheits-PR geführt. Ohne produktive Umgebungswerte waren
Instagram und Sportheim-Belegung nicht abrufbar; deren Integrationen sind
mit diesem Lauf nicht bestätigt. Die lokale Prüfung belegt keine
Produktionsauslieferung.

Der neue lokale Audit meldet 15 betroffene Pakete (vier hohe, elf moderate,
keine kritischen Funde), mit `--omit=dev` sieben (zwei hohe, fünf moderate),
jeweils ohne Next.js-Meldung. Die verbleibenden hohen Produktionsfunde betreffen
`brace-expansion` und `source-map-js`; ihre konkrete Ausnutzbarkeit ist nicht
geprüft. Dieser Rest bleibt eine Wartungsaufgabe.

Der historische [Auditvergleich 43414322205](https://github.com/BastiiSP/fcb-website/actions/runs/43414322205)
meldete zuvor für `main` und Sentry dieselben 19 Paketfunde (elf moderate,
sieben hohe, einer kritisch), davon elf in Produktionsabhängigkeiten. Sentry
fügte keine hinzu. Die damals installierte Next.js-Version `16.2.10` lag unter
der in [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
und [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr)
genannten Fehlerbehebung `16.4.1`. Historischer Workflow und neue lokale
Prüfungen gelten jeweils nur für ihren bezeichneten Stand.

## Manuelle Prüfung

- `https://www.fcbuku.de/datenschutz` öffnen → November 2026, Sentry, UptimeRobot
  und Sicherungskopien prüfen → FCB-Verantwortlicher, Sportheim-Anfrage enthalten,
  zutreffender Sicherungsstand; Fehlermerkmale: falscher Verein, fehlender
  Abschnitt oder vom belegten Prüfungsumfang abweichende Aussagen.
- `https://www.jfg-kunstadt-obermain.de/datenschutz` öffnen → dieselben
  Betriebsabschnitte prüfen → JFG-Verantwortlicher, keine Sportheim-Anfrage;
  Fehlermerkmale: FCB-Verantwortlicher oder Sportheim-Abschnitt.
- Beide Datenschutzseiten → im Footer hell/dunkel wechseln und Quellen per Tab
  fokussieren → lesbar, sichtbarer Fokus, richtige Links, kein Überlauf;
  Fehlermerkmale: Kontrastverlust, fehlender Fokus, defekter Link.
- Beide Produktionsstartseiten öffnen → richtige Marke und vollständige Anzeige;
  Fehlermerkmale: 5xx, Timeout, falsches Wappen oder Tenant.
- UptimeRobot → zwei Produktionsmonitore, 5-Minuten-Intervall und bestätigte
  E-Mailkontakte prüfen → Up und aktuelle automatische Läufe; Fehlermerkmale:
  pausiert, falsches Ziel, unbestätigte Adresse oder ausbleibende Ausführung.
- GitHub Actions → vorhandenen B2-Stand ohne neue Quellen wiederherstellen →
  Archiv, DB-/Dateivertrag und bei expliziter App-Option sämtliche API-/Browserfälle
  erfolgreich, Cleanup ausgeführt; Fehlermerkmale: fehlende Stufe, feste
  Fehlerphase, fremdes Projekt/Image, Datenartefakte oder fehlende Bereinigung.
- Sentry → Settings → Legal öffnen → Betreiberannahme dokumentiert;
  Fehlermerkmal: weiterhin „Review and Accept“.
- GitHub Actions → nach dem ersten Termin am 14.11.2026 um 03:27 UTC
  (04:27 Uhr Berlin) den Sicherungslauf öffnen → `event=schedule`, neuer Export,
  verschlüsselter Upload, erfolgreiche Budgetprüfung und Cleanup; anschließend
  Benachrichtigungseinstellung dem Betreiberkonto zuordnen. Fehlermerkmale:
  nur `workflow_dispatch`, übersprungener Sicherungsjob, Fehler oder fehlendes
  Cleanup. Verzögerungen sind möglich; ein fehlender Lauf ist kein Erfolgsbeleg.

## Quellen

- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: CLI Backup und Restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Backblaze B2: Kostenlimits](https://www.backblaze.com/docs/cloud-storage-data-caps-and-alerts)
- [Backblaze B2: Lifecycle-Regeln](https://www.backblaze.com/docs/cloud-storage-lifecycle-rules)
- [restic: Backblaze B2 über S3 und alte Versionen](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#backblaze-b2)
- [restic: Aufbewahrung und Gruppierung](https://restic.readthedocs.io/en/stable/060_forget.html)
- [Sentry: Developer-Tarif](https://sentry.io/pricing/)
- [Sentry: Keine Mehrverbrauchsabrechnung im Developer-Tarif](https://www.sentry.help/en/articles/13965037-can-i-set-up-an-on-demand-pay-as-you-go-budget-for-my-free-developer-plan)
- [Sentry: Aufbewahrungsfristen](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/)
- [Sentry: Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [UptimeRobot: Tarife](https://uptimerobot.com/pricing/)
- [GitHub: Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub: Benachrichtigungen für Workflow-Läufe](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- [GitHub: Actions-Benachrichtigungen einstellen](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
