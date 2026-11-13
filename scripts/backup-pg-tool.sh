#!/usr/bin/env bash
set -euo pipefail
tool="$(basename "$0")"
case "$tool" in psql|pg_dump|pg_restore) ;; *) echo 'Ungültiges PostgreSQL-Werkzeug.' >&2; exit 1;; esac
[[ -n "${TMPDIR:-}" && -d "$TMPDIR" && -f "${PGPASSFILE:-}" ]] || { echo 'Private PostgreSQL-Laufzeit fehlt.' >&2; exit 1; }
[[ "${BACKUP_POSTGRES_IMAGE:-}" =~ ^supabase/postgres@sha256:[a-f0-9]{64}$ ]] || { echo 'Unveränderliche PostgreSQL-Imagekennung fehlt.' >&2; exit 1; }
exec docker run --rm -i --network host \
  --mount "type=bind,source=$TMPDIR,target=$TMPDIR" \
  -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGPASSFILE -e PGSSLMODE -e PGSSLROOTCERT -e PGOPTIONS \
  "$BACKUP_POSTGRES_IMAGE" "$tool" "$@"
