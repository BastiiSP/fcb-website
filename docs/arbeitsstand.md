# Arbeitsstand – fcb-website

Stand: 13.11.2026. Der aktuelle Betriebsstand ist unten zusammengefasst;
Detailnachweise und Prüfgrenzen stehen in den verlinkten Themenquellen.

## Dokumentierter Stand

- `main` ist durch Pull Requests und fünf Pflichtchecks geschützt. Kostenloser
  Schema-Replay mit 27 Migrationen und 130 Prüfungen ist eingeführt. Maßgeblich:
  [Entwicklungsprozess](entwicklungsprozess.md) und
  [Migrationsabgleich](supabase-migration-abgleich.md).
- Beide Produktionsdomains sind erreichbar. UptimeRobot überwacht beide alle
  fünf Minuten mit belegten Down-/Up-E-Mails; Sentry ist im EU-Projekt produktiv,
  Client-/Serverfehler und Regression-Alarme sind geprüft. Die maßgebliche
  [Diensttabelle und Betriebsnachweise](betrieb.md#eingesetzte-dienste) bündeln
  Aufgaben, kostenlosen Rahmen und Grenzen.
- Der reguläre Gesamtlauf `43486494378` belegt aktuellen Export, verschlüsselten
  B2-Upload und erneuten isolierten Datenbank-/Dateirestore mit RLS, Policies,
  Katalog und erfolgreichem Cleanup. Die tatsächliche Anwendungsprobe
  `43483076155` prüft
  Storage-/Auth-API, Rollen-/Tenant-Fälle und zwei Browserfälle erfolgreich.
- `BACKUP_ENABLED=true` und Kostenflag sind zurückgelesen. Täglicher Zeitplan
  03:27 UTC ist aktiviert; erster tatsächlicher Cron-Lauf noch nicht beobachtet.
  Monatsprobe umfasst Datenbank/Dateien, App-Probe bleibt separat manuell.
- Rollen-, Tenant- und UI-Verträge: [AGENTS.md](../AGENTS.md), Datenbankregeln:
  [supabase/AGENTS.md](../supabase/AGENTS.md).

## Nächster Schritt und Prüfgrenze

- Sentry-Auftragsverarbeitungsvertrag durch den Betreiber prüfen und annehmen.
- Ersten geplanten Sicherungslauf und dessen E-Mail-Empfänger kontrollieren.
  Repository nicht erneut initialisieren. Weiteres Wachstum unter den
  bestehenden kostenlosen Caps beobachten; automatisches Pruning fehlt.
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
- [docs/superpowers/plans/2026-06-15-auth-pages-design-overhaul.md](<../docs/superpowers/plans/2026-06-15-auth-pages-design-overhaul.md>)
- [docs/superpowers/plans/2026-06-15-impressum-datenschutz.md](<../docs/superpowers/plans/2026-06-15-impressum-datenschutz.md>)
- [docs/superpowers/plans/2026-06-15-supabase-keepalive.md](<../docs/superpowers/plans/2026-06-15-supabase-keepalive.md>)
- [docs/superpowers/plans/2026-06-15-supabase-security-advisors.md](<../docs/superpowers/plans/2026-06-15-supabase-security-advisors.md>)
- [docs/superpowers/plans/2026-06-17-pitch-auth-apply.md](<../docs/superpowers/plans/2026-06-17-pitch-auth-apply.md>)
- [docs/superpowers/plans/2026-06-18-design-system-dual-theme.md](<../docs/superpowers/plans/2026-06-18-design-system-dual-theme.md>)
- [docs/superpowers/plans/2026-06-19-dual-theme-refinements.md](<../docs/superpowers/plans/2026-06-19-dual-theme-refinements.md>)
- [docs/superpowers/plans/2026-06-27-vorstand-buchungsuebersicht.md](<../docs/superpowers/plans/2026-06-27-vorstand-buchungsuebersicht.md>)
- [docs/superpowers/specs/2026-06-15-supabase-security-advisors-design.md](<../docs/superpowers/specs/2026-06-15-supabase-security-advisors-design.md>)
- [docs/superpowers/specs/2026-06-18-design-system-dual-theme-design.md](<../docs/superpowers/specs/2026-06-18-design-system-dual-theme-design.md>)
- [docs/superpowers/specs/2026-07-29-jfg-domain-multi-tenant-design.md](<../docs/superpowers/specs/2026-07-29-jfg-domain-multi-tenant-design.md>)

