#!/usr/bin/env bash
set -euo pipefail
tool="$(basename "$0")"
case "$tool" in psql|pg_dump|pg_restore) ;; *) echo 'Ungültiges PostgreSQL-Werkzeug.' >&2; exit 1;; esac
[[ -n "${TMPDIR:-}" && -d "$TMPDIR" && -f "${PGPASSFILE:-}" ]] || { echo 'Private PostgreSQL-Laufzeit fehlt.' >&2; exit 1; }
[[ "${BACKUP_POSTGRES_IMAGE:-}" =~ ^supabase/postgres@sha256:[a-f0-9]{64}$ ]] || { echo 'Unveränderliche PostgreSQL-Imagekennung fehlt.' >&2; exit 1; }
certificate_mount=()
if [[ -n "${PGSSLROOTCERT:-}" ]]; then
  [[ "$PGSSLROOTCERT" == /* && -f "$PGSSLROOTCERT" ]] || { echo 'Supabase-CA fehlt.' >&2; exit 1; }
  [[ "$(sha256sum "$PGSSLROOTCERT" | cut -d ' ' -f 1)" == 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7 ]] || { echo 'Supabase-CA stimmt nicht mit dem geprüften Original überein.' >&2; exit 1; }
  certificate_mount=(--mount "type=bind,source=$PGSSLROOTCERT,target=$PGSSLROOTCERT,readonly")
fi
exec docker run --rm -i --network host \
  --mount "type=bind,source=$TMPDIR,target=$TMPDIR" \
  ${certificate_mount[@]+"${certificate_mount[@]}"} \
  -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGPASSFILE -e PGSSLMODE -e PGSSLROOTCERT -e PGOPTIONS \
  "$BACKUP_POSTGRES_IMAGE" "$tool" "$@"
