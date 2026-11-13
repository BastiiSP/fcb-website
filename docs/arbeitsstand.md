# Arbeitsstand – fcb-website

Stand: 13.11.2026. Der aktuelle Betriebsstand ist unten zusammengefasst;
Detailnachweise und Prüfgrenzen stehen in den verlinkten Themenquellen.

## Dokumentierter Stand

- `main` ist durch Pull Requests und fünf Pflichtchecks geschützt. Kostenloser
  Schema-Replay mit 27 Migrationen und 130 Prüfungen ist eingeführt. Maßgeblich:
  [Entwicklungsprozess](entwicklungsprozess.md) und
  [Migrationsabgleich](supabase-migration-abgleich.md).
- Beide Produktionsdomains sind erreichbar. UptimeRobot überwacht beide alle
  fünf Minuten mit belegten Down-/Up-E-Mails. Zusätzlich sind zwei echte geplante
  GitHub-HTTP-Läufe erfolgreich, zuletzt 13.11.2026 um 22:43 UTC. Sentry ist
  im EU-Projekt produktiv,
  Client-/Serverfehler und Regression-Alarme sind geprüft; DPA 5.1.0 wurde am
  13.11.2026 mit Betreiberfreigabe angenommen. Die maßgebliche
  [Diensttabelle und Betriebsnachweise](betrieb.md#eingesetzte-dienste) bündeln
  Aufgaben, kostenlosen Rahmen und Grenzen.
- Der reguläre Gesamtlauf `43486494378` belegt aktuellen Export, verschlüsselten
  B2-Upload und erneuten isolierten Datenbank-/Dateirestore mit RLS, Policies,
  Katalog und erfolgreichem Cleanup. Die tatsächliche Anwendungsprobe
  `43483076155` prüft
  Storage-/Auth-API, Rollen-/Tenant-Fälle und zwei Browserfälle erfolgreich.
- `BACKUP_ENABLED=true` und Kostenflag sind zurückgelesen. Täglicher Zeitplan
  03:27 UTC ist aktiviert; erstes Fenster danach am 14.11.2026 um 03:27 UTC
  (04:27 Uhr Berlin), bei Prüfung am Vorabend noch nicht erreicht.
  Monatsprobe umfasst Datenbank/Dateien, App-Probe bleibt separat manuell.
- Sicherheitswartung im aktuellen Arbeitsstand: Next.js `16.4.5`, `sharp`
  `0.35.5`; vor PR-Einreichung lokale Pflichtprüfungen und Tenant-E2E erfolgreich.
  CI- und Auslieferungsnachweise in [Sicherheits-PR #22](https://github.com/BastiiSP/fcb-website/pull/22); Auditrestfunde
  und genaue Grenzen: [Betrieb](betrieb.md#sicherheitswartung).
- Rollen-, Tenant- und UI-Verträge: [AGENTS.md](../AGENTS.md), Datenbankregeln:
  [supabase/AGENTS.md](../supabase/AGENTS.md).

## Nächster Schritt und Prüfgrenze

- Ersten geplanten Sicherungslauf und dessen E-Mail-Empfänger kontrollieren.
  Repository nicht erneut initialisieren. Weiteres Wachstum unter den
  bestehenden kostenlosen Caps beobachten; automatisches Pruning fehlt. Das
  [Aufbewahrungskonzept](betrieb.md#aufbewahrung-vorbereiten) ist nur vorbereitet;
  Löschung und Lifecycle-Änderungen sind noch nicht freigegeben.
- Konkrete Browser-Prüfschritte für beide Domains, Themes, Monitoring und Restore:
  [Betrieb](betrieb.md#manuelle-prüfung). Die App-Probe belegt ihre benannten Fälle,
  keine pauschale Abnahme aller Abläufe oder zugesicherte RPO/RTO.
- Keine neue Feature-Priorität festgelegt. Fremde lokale Änderungen sind nicht
  Teil dieser Abnahme.

## Vorhandene Planungen und Nachweise

Historische Dokumente, keine automatisch freigegebene Aufgabenliste:

- [docs/superpowers/plans/2026-06-06-auth-bereich-varianten.md](<../docs/superpowers/plans/2026-06-06-auth-bereich-varianten.md>)
- [docs/superpowers/plans/2026-06-06-design-round-2-footer-profilleiste.md](<../docs/superpowers/plans/2026-06-06-design-round-2-footer-profilleiste.md>)
- [docs/superpowers/plans/2026-06-07-consent-verwaltung.md](<../docs/superpowers/plans/2026-06-07-consent-verwaltung.md>)
- [docs/superpowers/plans/2026-06-07-design-runde-2-finalisierung.md](<../docs/superpowers/plans/2026-06-07-design-runde-2-finalisierung.md>)
- [docs/superpowers/plans/2026-06-07-mobile-header-footer-fixes.md](<../docs/superpowers/plans/2026-06-07-mobile-header-footer-fixes.md>)
