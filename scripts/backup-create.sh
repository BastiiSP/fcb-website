#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ -n "${TMPDIR:-}" && -d "$TMPDIR" ]] || { echo 'Privates Laufzeitverzeichnis fehlt.' >&2; exit 1; }
result_file="$TMPDIR/backup-result.json"
rm -f -- "$result_file"

for variable in PGHOST PGPORT PGUSER PGDATABASE PGPASSFILE PGSSLMODE BACKUP_PROJECT_REF SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RESTIC_REPOSITORY RESTIC_PASSWORD_FILE; do
  if [[ -z "${!variable:-}" ]]; then printf 'Erforderliche Umgebungsvariable fehlt: %s\n' "$variable" >&2; exit 1; fi
done
for command in pg_dump psql node restic sha256sum aws; do
  command -v "$command" >/dev/null || { printf 'Programm fehlt: %s\n' "$command" >&2; exit 1; }
done
[[ -f "$PGPASSFILE" && -f "$RESTIC_PASSWORD_FILE" ]] || { echo 'Eine benötigte Passwortdatei fehlt.' >&2; exit 1; }
[[ "$PGHOST" != *','* && "$PGHOST" != /* ]] || { echo 'PGHOST muss genau einen Netzwerkhost enthalten.' >&2; exit 1; }
[[ "$PGSSLMODE" == require || "$PGSSLMODE" == verify-full ]] || { echo 'PGSSLMODE muss require oder verify-full sein.' >&2; exit 1; }
[[ "$BACKUP_PROJECT_REF" =~ ^[a-z0-9]{20}$ && "$SUPABASE_URL" == "https://${BACKUP_PROJECT_REF}.supabase.co" ]] || { echo 'Projektkennung und Storage-URL passen nicht zusammen.' >&2; exit 1; }
[[ "${BACKUP_FREE_TIER_CONFIRMED:-false}" == true && "$RESTIC_REPOSITORY" == "s3:${BACKUP_S3_ENDPOINT:-}/${BACKUP_S3_BUCKET:-}/fcb-website" ]] || { echo 'Bestätigtes kostenloses Sicherungsziel fehlt.' >&2; exit 1; }
if [[ "$PGHOST" != "db.${BACKUP_PROJECT_REF}.supabase.co" ]]; then
  [[ "$PGHOST" =~ ^[a-z0-9-]+\.pooler\.supabase\.com$ && "$PGUSER" == "postgres.${BACKUP_PROJECT_REF}" ]] || { echo 'Datenbankhost oder Pooler-Benutzer passt nicht zur Projektkennung.' >&2; exit 1; }
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
mkdir -m 700 "$temporary/payload"
# Auch bei versehentlich weiterreichenden DB-Rechten ausschließlich lesen.
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=600000'
node "$root/scripts/backup-storage.mjs" inventory "$temporary/payload"
node "$root/scripts/backup-database.mjs" "$temporary/payload"
node "$root/scripts/backup-storage.mjs" download "$temporary/payload"
rm "$temporary/payload/database-private.log"
(
  cd "$temporary/payload"
  shopt -s nullglob
  files=(backup.json database.dump inventory.json storage.json objects/*)
  sha256sum "${files[@]}" > SHA256SUMS
)
node "$root/scripts/backup-b2-budget.mjs" "$temporary/payload"
(
  cd "$temporary"
  # Ausgaben können Dateinamen enthalten und bleiben deshalb im privaten Laufzeitverzeichnis.
  if ! restic backup --json --host fcb-website --tag fcb-backup payload > "$temporary/restic-private.jsonl" 2> "$temporary/restic-private.log"; then
    echo 'Verschlüsselte Sicherung fehlgeschlagen; keine privaten Logs veröffentlicht.' >&2
    exit 1
  fi
)
if ! node - "$temporary/restic-private.jsonl" "$result_file" <<'NODE'
const fs = require('node:fs');
try {
  const messages = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const summaries = messages.filter((message) => message && message.message_type === 'summary');
  if (summaries.length !== 1 || messages.at(-1) !== summaries[0] || !/^[a-f0-9]{64}$/.test(summaries[0].snapshot_id ?? '')) throw new Error();
  fs.writeFileSync(process.argv[3], JSON.stringify({ snapshot: summaries[0].snapshot_id }), { mode: 0o600, flag: 'wx' });
} catch {
  process.exitCode = 1;
}
NODE
then
  rm -f -- "$result_file"
  echo 'Sicherungsnachweis konnte nicht eindeutig erstellt werden.' >&2
  exit 1
fi
echo 'Verschlüsselte Sicherung erstellt. Es wurden keine alten Sicherungen gelöscht.'
