# Arbeitsstand – fcb-website

Stand: 13.11.2026. Der aktuelle Betriebsstand ist unten zusammengefasst;
Detailnachweise und Prüfgrenzen stehen in den verlinkten Themenquellen.

## Dokumentierter Stand

- `main` ist durch Pull Requests und fünf Pflichtchecks geschützt. CI und der
  kostenlose isolierte Schema-Replay mit 27 Migrationen und 130 Prüfungen sind
  eingeführt. Maßgeblich: [Entwicklungsprozess](entwicklungsprozess.md) und
  [Migrationsabgleich](supabase-migration-abgleich.md).
- Beide Produktionsdomains sind erreichbar. UptimeRobot überwacht beide alle
  fünf Minuten; Down-/Up-E-Mailalarm ist belegt. Sentry ist im EU-Projekt
  produktiv ausgeliefert; Client-/Serverfehler und Regression-Alarme sind in
  geschützter Vorschau geprüft. Dienstübersicht und Nachweise: [Betrieb](betrieb.md).
- B2-Zugang, kostenlose Caps und Speicherbudget sind geprüft; das verschlüsselte
  Repository ist initialisiert. Der produktive Export und verschlüsselte
  B2-Upload sowie erneuter Download, Prüfsummen und Archivlesbarkeit sind im Lauf
  `43475169764` belegt. Der isolierte Restore scheitert noch; Anwendungsabnahme
  und Sicherungszeitplan bleiben offen beziehungsweise deaktiviert.
- Rollen-, Tenant- und UI-Verträge stehen in [AGENTS.md](../AGENTS.md);
  Datenbankregeln zusätzlich in [supabase/AGENTS.md](../supabase/AGENTS.md).

## Nächster Schritt und Prüfgrenze

- Vorhandenen Stand über den manuellen Restore-only-Workflow ohne neue
  Quellzugriffe prüfen und die feste Restore-Fehlerphase eingrenzen. Repository
  nicht erneut initialisieren. Erst nach vollständigem Sicherungs- und
  Wiederherstellungsnachweis den Zeitplan aktivieren. Konkrete Browser-Prüfschritte:
  [Betrieb](betrieb.md#manuelle-prüfung).
- Sentry-Auftragsverarbeitungsvertrag durch den Betreiber prüfen und annehmen.
  Keine neue Feature-Priorität festgelegt.
- Die bereits belegten Live-Prüfungen ersetzen weder die ausstehende
  Wiederherstellungsprobe noch eine vollständige Prüfung aller Anwendungsabläufe.
  Vorhandene fremde lokale Änderungen sind nicht Teil dieser Abnahme.

## Vorhandene Planungen und Nachweise

Historische Dokumente, keine automatisch freigegebene Aufgabenliste:

- `.superpowers/sdd/progress.md`: nur lokal vorhandener Altstand, nicht im
  öffentlichen Repository versioniert.
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

