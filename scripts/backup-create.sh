#!/usr/bin/env bash
set -euo pipefail
umask 077

for variable in PGHOST PGPORT PGUSER PGDATABASE PGPASSFILE PGSSLMODE BACKUP_PROJECT_REF SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RESTIC_REPOSITORY RESTIC_PASSWORD_FILE; do
  if [[ -z "${!variable:-}" ]]; then printf 'Erforderliche Umgebungsvariable fehlt: %s\n' "$variable" >&2; exit 1; fi
done
for command in pg_dump psql node restic sha256sum; do
  command -v "$command" >/dev/null || { printf 'Programm fehlt: %s\n' "$command" >&2; exit 1; }
done
[[ -f "$PGPASSFILE" && -f "$RESTIC_PASSWORD_FILE" ]] || { echo 'Eine benötigte Passwortdatei fehlt.' >&2; exit 1; }
[[ "$PGHOST" != *','* && "$PGHOST" != /* ]] || { echo 'PGHOST muss genau einen Netzwerkhost enthalten.' >&2; exit 1; }
[[ "$PGSSLMODE" == require || "$PGSSLMODE" == verify-full ]] || { echo 'PGSSLMODE muss require oder verify-full sein.' >&2; exit 1; }
[[ "$BACKUP_PROJECT_REF" =~ ^[a-z0-9]{20}$ && "$SUPABASE_URL" == "https://${BACKUP_PROJECT_REF}.supabase.co" ]] || { echo 'Projektkennung und Storage-URL passen nicht zusammen.' >&2; exit 1; }
if [[ "$PGHOST" != "db.${BACKUP_PROJECT_REF}.supabase.co" ]]; then
  [[ "$PGHOST" =~ ^[a-z0-9-]+\.pooler\.supabase\.com$ && "$PGUSER" == "postgres.${BACKUP_PROJECT_REF}" ]] || { echo 'Datenbankhost oder Pooler-Benutzer passt nicht zur Projektkennung.' >&2; exit 1; }
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
mkdir -m 700 "$temporary/payload"
server_version="$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SHOW server_version')"
[[ "$server_version" =~ ^[0-9]+\.[0-9]+ ]] || { echo 'Datenbankversion konnte nicht bestimmt werden.' >&2; exit 1; }
export BACKUP_SERVER_VERSION="$server_version"
node -e 'const fs = require("node:fs"); const m = { schemaVersion: 1, createdAt: new Date().toISOString(), projectRef: process.env.BACKUP_PROJECT_REF, serverVersion: process.env.BACKUP_SERVER_VERSION }; fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2), { mode: 0o600 });' "$temporary/payload/backup.json"
node "$root/scripts/backup-storage.mjs" inventory "$temporary/payload"
pg_dump --format=custom --no-owner --file="$temporary/payload/database.dump"
node "$root/scripts/backup-storage.mjs" download "$temporary/payload"
(
  cd "$temporary/payload"
  shopt -s nullglob
  files=(backup.json database.dump inventory.json storage.json objects/*)
  sha256sum "${files[@]}" > SHA256SUMS
)
(
  cd "$temporary"
  restic backup --host fcb-website --tag fcb-backup payload
)
echo 'Sicherung erstellt. Aufbewahrung und Restore-Prüfung sind separat auszuführen.'
