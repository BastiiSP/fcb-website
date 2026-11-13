#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
test -x "$root/scripts/backup-pg-tool.sh"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir "$work/bin"
ln -s "$root/scripts/backup-pg-tool.sh" "$work/bin/psql"
ln -s "$root/scripts/backup-pg-tool.sh" "$work/bin/pg_restore"
cat > "$work/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$MOCK_ARGUMENTS"
DOCKER
chmod +x "$work/bin/docker"
touch "$work/pgpass"
export PATH="$work/bin:$PATH" TMPDIR="$work" PGPASSFILE="$work/pgpass" MOCK_ARGUMENTS="$work/args"
export BACKUP_POSTGRES_IMAGE="supabase/postgres@sha256:$(printf 'a%.0s' {1..64})"
export PGSSLROOTCERT="$root/scripts/certificates/supabase-prod-ca-2021.crt"
"$work/bin/psql"
grep -Fxq "type=bind,source=$PGSSLROOTCERT,target=$PGSSLROOTCERT,readonly" "$MOCK_ARGUMENTS"
unset PGSSLROOTCERT
"$work/bin/pg_restore" --list
! grep -Fq 'readonly' "$MOCK_ARGUMENTS"
export PGSSLROOTCERT="$work/pgpass"
if "$work/bin/psql" >/dev/null 2>&1; then echo 'Ungültige CA wurde akzeptiert.' >&2; exit 1; fi
echo 'PostgreSQL-Wrapper: CA-Mount und Offline-Restore geprüft.'
