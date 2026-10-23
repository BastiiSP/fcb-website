# FCB – Datenbankreferenz

Ergänzt das Wurzelpaar; vor allen Schema-, RLS-, Rollen-, Auth- und SQL-Arbeiten lesen. Beschreibt den übernommenen Vertragsstand; aktuelle Migrationen vor Änderungen prüfen. Gemeinsame Regeln nicht ersetzen.

## Datenbankschema (Phase 1 – aktiv)

### Tabelle: `profiles`

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | FK → auth.users, Primary Key |
| `vorname` | TEXT | NOT NULL |
| `nachname` | TEXT | NOT NULL |
| `telefonnummer` | TEXT | optional |
| `rolle` | TEXT | DEFAULT 'ausstehend', CHECK (ausstehend/mitglied/trainer/vorstand/admin) |
| `mannschaft` | TEXT[] | Mehrfachauswahl möglich |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto via Trigger |
| `geburtsdatum` | DATE | optional |
| `strasse` | TEXT | optional |
| `plz` | TEXT | optional |
| `ort` | TEXT | optional |
| `trainer_lizenzen` | TEXT[] | optional, Mehrfachauswahl möglich |
| `avatar_url` | TEXT | optional, CHECK: nur URLs aus dem eigenen Storage-Bucket `avatars` |
| `verein` | TEXT[] | fcb/jfg (auch beide oder leer). Steuert, wessen `mitglieder` ein vorstand sieht. Nur admin darf ändern (Trigger). Bei Registrierung aus dem Tenant vorbelegt |

### Tabelle: `buchungen`

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid() |
| `platz` | TEXT | CHECK: hauptplatz / nebenplatz |
| `platzanteil` | TEXT | CHECK: viertel / halb / ganz |
| `anlass` | TEXT | CHECK: training / freundschaftsspiel / punktspiel / platzpflege |
| `startzeit` | TIMESTAMPTZ | NOT NULL |
| `endzeit` | TIMESTAMPTZ | NOT NULL |
| `mannschaft` | TEXT | NOT NULL |
| `buchende_person` | TEXT | NOT NULL |
| `bemerkung` | TEXT | optional |
| `user_id` | UUID | FK → auth.users, ON DELETE SET NULL |
| `serien_id` | UUID | optional – gemeinsame ID aller Termine einer Serienbuchung (`lib/serienbuchung.ts`) |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto via Trigger |

Optionslisten/Labels der CHECK-Felder: `src/lib/buchungsOptionen.ts` (single source of truth).

### Tabelle: `sportheim_anfragen` (FCB)

Öffentliche Sportheim-Anfragen + interne Sperrtermine in einer Zeitquelle.
`typ`: anfrage / sperrung · `status`: offen / angenommen / abgelehnt. CHECKs erzwingen
Pflicht-Kontaktdaten bei `anfrage` und leere Personendaten + `angenommen` bei `sperrung`.
RLS: anon + authenticated dürfen nur INSERTen mit `typ='anfrage'`, `status='offen'`,
`erstellt_von IS NULL`; Lesen/Ändern/Löschen/Sperrungen nur vorstand/admin. Die öffentliche Belegung liefert die Funktion `sportheim_belegte_zeiten()` (ohne
Personendaten). Details: `supabase/migrations/20260707120000_create_sportheim_anfragen.sql`.

### Storage & Migrationen

- Bucket `avatars` – Profilbilder, öffentliche URL landet in `profiles.avatar_url`.
- Migrationen liegen versioniert in `supabase/migrations/` – neue Migration dort ablegen UND per
  MCP anwenden (danach live prüfen, nicht nur committen).

### Tabelle: `mitglieder` (Phase 2 – aktiv)

Vereinsmitglieder ohne Login-Konto. Wird von Vorstand/Admin gepflegt.

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid(), Primary Key |
| `mitgliedsnummer` | INTEGER | GENERATED ALWAYS AS IDENTITY – automatisch, kein Input-Feld |
| `vorname`, `nachname` | TEXT | NOT NULL |
| `email`, `telefonnummer` | TEXT | optional |
| `geburtsdatum`, `eintrittsdatum` | DATE | optional |
| `status` | TEXT | CHECK (aktiv/passiv/ehrenamt/gekündigt), DEFAULT 'aktiv' |
| `mannschaft` | TEXT[] | optional |
| `notizen` | TEXT | optional |
| `erstellt_von` | UUID | FK → auth.users, SET NULL bei Löschung |
| `created_at`, `updated_at` | TIMESTAMPTZ | auto, updated_at via Trigger |

Zusätzlich `verein` TEXT[] NOT NULL (fcb/jfg, mind. einer) – Tenant-Trennung seit 2026-09-24.

RLS: admin sieht/verwaltet alle; vorstand nur Zeilen mit `verein && get_own_verein()` (strikt:
JFG-Vorstand sieht keine FCB-Mitglieder und umgekehrt). Trigger `trg_mitglieder_verein_guard`
verhindert, dass ein vorstand fremde Vereine hinzufügt/entfernt. Trainer/mitglied: kein Zugriff.
Das Trainer-Verzeichnis liest Profile nur über die RPC `trainer_verzeichnis()` (feste Spalten).

### Tabelle: `mannschaftsanfragen`

Anfragen von `mitglied`-Nutzern zum Beitritt/Austritt aus einer Mannschaft. Wird von Vorstand/Admin im Vorstandsbereich verwaltet.

| Spalte | Typ | Besonderheit |
|---|---|---|
| `id` | UUID | gen_random_uuid(), Primary Key |
| `user_id` | UUID | FK → auth.users |
| `typ` | TEXT | Art der Anfrage (z. B. beitritt / austritt) |
| `mannschaft` | TEXT | Betroffene Mannschaft |
| `begruendung` | TEXT | optional |
| `status` | TEXT | DEFAULT 'offen'; weitere Werte: genehmigt / abgelehnt |
| `created_at` | TIMESTAMPTZ | auto |

RLS: Nutzer sehen/erstellen nur eigene Anfragen; vorstand und admin verwalten alle.

### Tabelle: `keepalive` (technisch)

Verhindert das Pausieren des Supabase-Free-Tiers: Der GitHub-Actions-Workflow
`.github/workflows/supabase-keepalive.yml` schreibt alle 3 Tage per anon-INSERT einen
Eintrag (RLS-Policy erlaubt anon nur INSERT). Kein Fach-Schema – nicht umbauen, nicht in
Features verwenden. Hintergrund: anon-Leseanfragen zählt Supabase nicht zuverlässig als
Aktivität, deshalb Write statt Read.


## Pflege dieses Dateipaars

Direkte aktuelle Nutzeraufträge haben Vorrang. Vor Regeländerungen beide Dateien lesen und Unterschiede inhaltlich zusammenführen; gültige Regeln erhalten. AGENTS.md und CLAUDE.md unmittelbar gemeinsam ändern und danach mit `cmp` auf Bytegleichheit prüfen. Anbieterunterschiede ausdrücklich kennzeichnen und in beiden Dateien führen. Codex lädt AGENTS.md; Claude Code lädt bei diesem Paar CLAUDE.md.
