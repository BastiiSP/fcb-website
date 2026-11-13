## Änderung

Welches konkrete Problem wird gelöst und wie verhält sich die Website danach?

## Prüfung

- [ ] `npm run lint`
- [ ] `npx next typegen && npx tsc --noEmit`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] GitHub-Checks für den aktuellen PR-Stand erfolgreich, einschließlich Schema-Replay
- [ ] Unabhängige Codeprüfung durchgeführt, Befunde behoben oder begründet

Konkrete Ergebnisse, Lauf-Links und noch offene Prüfungen:

Manuelle Browser-Schritte für Basti, jeweils mit Fehlermerkmalen:

- Seite → Aktion → Erwartung; Fehlermerkmale

Bei UI, Text oder Routing beide Tenants und betroffene Themes prüfen. Bei
Datenbankänderungen Migration, RLS, Grants und Live-Ausführung gesondert belegen.

## Risiken und Rückweg

Verbleibende Risiken, erforderliche Konfiguration und Rücknahme der Änderung:

Keine Zugangsdaten, personenbezogenen Daten oder privaten Dateipfade aufnehmen.
