# Entwicklungsprozess

Stand: 13. November 2026. Änderungen werden über einen Arbeitsbranch und Pull
Request nach `main` übernommen. Ein Merge auf `main` startet das
Vercel-Deployment.

## Belegter Stand und Ziel

Die CI mit Lint, TypeScript, Unit-Tests und Produktionsbuild ist über PR #6
eingeführt. Der Lauf `43397095100` war erfolgreich, Merge-Commit `61c7934`.
Schema-Replay wird separat eingeführt. Seine Aufnahme als Pflichtcheck erfolgt
erst nach einem erfolgreichen GitHub-Lauf.

Der Schutz von `main` ist derzeit **nicht bestätigt**. Die folgende Konfiguration
beschreibt das Ziel und ist kein Nachweis einer bereits aktiven GitHub-Regel.

| Regel für `main` | Zielkonfiguration |
| --- | --- |
| Änderungen | Pull Request erforderlich, kein direkter Push |
| Genehmigungen | 0 verpflichtende Reviews beim Solo-Maintainer |
| Pflichtchecks | `Lint`, `TypeScript`, `Unit-Tests`, `Produktionsbuild` |
| Zusätzlicher Pflichtcheck | `Migrationen und Schema-Vertrag`, sobald erfolgreich eingeführt |
| Aktualität | Branch muss vor dem Merge mit `main` aktuell sein |
| Force-Push und Branch-Löschung | Verboten |
| Umgehung | Keine Ausnahme für Administratoren oder sonstige Bypass-Akteure |

Null verpflichtende GitHub-Genehmigungen vermeidet eine Selbstfreigabe-Sperre:
Der PR-Autor kann seinen eigenen PR nicht genehmigen. Eine unabhängige Prüfung
durch einen zweiten Prüfer bleibt Teil des Arbeitsablaufs und wird im PR
dokumentiert. Sobald ein weiterer menschlicher Maintainer verfügbar ist, kann
eine verpflichtende Genehmigung gesondert beschlossen werden.

## Ablauf je Änderung

1. Auftrag vollständig lesen, betroffene Projektregeln prüfen und den Plan
   freigeben lassen. Für eng umrissene Micro-Fixes gilt die Ausnahme aus
   `AGENTS.md`.
2. Von aktuellem `main` einen beschreibenden Arbeitsbranch erstellen. Änderung
   auf den beauftragten Umfang begrenzen. Fremde oder bereits vorhandene lokale
   Änderungen nicht mit aufnehmen.
3. Lokal Lint, TypeScript, passende Tests und Build ausführen. Einen konkreten
   Fehler als solchen dokumentieren. Ein lokales Ergebnis ersetzt den
   GitHub-Check nicht.
4. Nur eigene Dateien gezielt stagen und auf den Arbeitsbranch pushen. Pull
   Request mit der [Vorlage](../.github/pull_request_template.md) erstellen.
   Problem, Ergebnis, Prüfungen, Restrisiken und Rückweg für einen unabhängigen
   Leser beschreiben.
5. Code durch einen unabhängigen zweiten Prüfer prüfen lassen. Findings
   bearbeiten. Rollen und RLS nur nach der
   ausdrücklich vorgesehenen Rücksprache ändern.
6. Sämtliche Pflichtchecks am aktuellen PR-Commit abwarten. Hat sich `main`
   verändert, Branch aktualisieren, Konflikte bearbeiten und neue Prüfläufe
   abwarten. Grüne Checks eines älteren Commits genügen nicht.
7. Erst danach den PR mergen. Den entstandenen Vercel-Lauf und beide betroffenen
   Produktionsauftritte prüfen. Unterbrochene oder fehlgeschlagene Deployments
   ausdrücklich als offen melden.
8. Ergebnis und konkrete manuelle Browser-Schritte im vorgeschriebenen AI Brain
   Update festhalten. Basti prüft vor der nächsten Entwicklungsaufgabe.

Ein fehlerhafter Merge wird über einen gesonderten Revert-PR zurückgenommen.
Keine Historie von `main` per Force-Push umschreiben. Datenbankmigrationen können
einen eigenen Rückweg benötigen; ein Code-Revert stellt gelöschte Daten nicht
wieder her.

## GitHub-Regel einrichten und nachweisen

Nach erfolgreicher Einführung aller gewünschten Checks unter **Repository →
Settings → Rules → Rulesets** oder **Branches** die Regel für `main` einrichten.
Die in GitHub tatsächlich erschienenen Check-Namen auswählen. Sicherstellen,
dass die Regel aktiv ist, das richtige Branch-Muster trifft, Aktualität verlangt
und keine Umgehung zulässt. Aktivierung und unabhängige Prüfung mit Zeitpunkt
und überprüften Einstellungen dokumentieren.

Ein PR mit sichtbarem roten Pflichtcheck muss einen gesperrten Merge zeigen. Ein
erfolgreicher Check in einem ungeschützten Repository beweist keinen Schutz.
Zum Nachweis keine absichtlichen Force-Pushes oder Branch-Löschungen auf `main`
ausführen.

## Manuelle Prüfung

- GitHub Settings → Regel für `main` öffnen → aktiv, richtige Branch-Zuordnung,
  vier CI-Pflichtchecks und nach Einführung Schema-Vertrag, aktueller Branch
  erforderlich, kein Force-Push/Löschen/Bypass; Fehlermerkmale: inaktive Regel,
  falsches Muster, fehlende Checks oder Ausnahmen.
- Pull Request mit fehlgeschlagenem Pflichtcheck → Merge-Bereich öffnen → Merge
  gesperrt; Fehlermerkmale: trotz rotem Check normaler Merge möglich oder Check
  nicht als erforderlich markiert.
- Pull Request nach Änderung des Zielbranches → Aktualitätsstatus prüfen →
  Aktualisierung und neue Checks erforderlich; Fehlermerkmale: veralteter
  grüner Stand genügt für Merge.
- Eigener Pull Request mit allen aktuellen Checks grün → Merge-Voraussetzungen
  prüfen → keine fremde GitHub-Genehmigung zwingend nötig, unabhängige Prüfung
  im PR dokumentiert; Fehlermerkmale: Selbstfreigabe-Sperre oder ungeprüfte
  Findings.
- Vercel nach Merge → Deployment öffnen, anschließend beide Domains prüfen →
  neuer Commit erfolgreich ausgeliefert, richtige Marke und betroffene Funktion
  korrekt; Fehlermerkmale: alter Commit, Buildfehler, 5xx oder Tenant-Verwechslung.

## Weiterführend

- [CI-Workflow](../.github/workflows/ci.yml)
- [Schema-Replay](../.github/workflows/migrations.yml)
- [Migrationen und Abgleich](supabase-migration-abgleich.md)
- [Betrieb, Backups und Alarme](betrieb.md)
