#!/usr/bin/env bash
set -euo pipefail
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin" "$work/snap" "$work/out" "$work/bad"
realnode=$(command -v node)
cat > "$work/bin/psql" <<'STUB'
#!/usr/bin/env bash
printf '17.6.1\n'
STUB
cat > "$work/bin/pg_dump" <<'STUB'
#!/usr/bin/env bash
for arg in "$@"; do case "$arg" in --file=*) printf 'fake archive' > "${arg#--file=}";; esac; done
STUB
cat > "$work/bin/pg_restore" <<'STUB'
#!/usr/bin/env bash
[[ "$(cat "$2")" == 'fake archive' ]]
STUB
cat > "$work/bin/node" <<'STUB'
#!/usr/bin/env bash
if [[ "$1" == */backup-storage.mjs ]]; then
  if [[ "$2" == inventory ]]; then printf '{}' > "$3/inventory.json"; else mkdir "$3/objects"; printf 'fixture' > "$3/objects/object"; printf '{}' > "$3/storage.json"; fi
else exec "$REAL_NODE" "$@"; fi
STUB
cat > "$work/bin/restic" <<'STUB'
#!/usr/bin/env bash
if [[ "$1" == backup ]]; then cp -R payload "$MOCK_SNAP/"; elif [[ "$1" == restore ]]; then cp -R "$MOCK_SNAP/payload" "$4/"; else exit 1; fi
STUB
chmod +x "$work/bin/"*
touch "$work/pgpass" "$work/resticpass"
export PATH="$work/bin:$PATH" REAL_NODE="$realnode" MOCK_SNAP="$work/snap" TMPDIR="$work" PGHOST=db.abcdefghijklmnopqrst.supabase.co PGPORT=5432 PGUSER=test PGDATABASE=postgres PGPASSFILE="$work/pgpass" PGSSLMODE=verify-full BACKUP_PROJECT_REF=abcdefghijklmnopqrst SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co SUPABASE_SERVICE_ROLE_KEY=fixture RESTIC_REPOSITORY=fixture RESTIC_PASSWORD_FILE="$work/resticpass"
bash scripts/backup-create.sh >/dev/null
[[ -z "$(find "$work" -mindepth 1 -maxdepth 1 -name 'tmp.*' -print -quit)" ]]
bash scripts/restore-verify.sh latest "$work/out" >/dev/null
printf 'corrupt' > "$work/snap/payload/objects/object"
if bash scripts/restore-verify.sh latest "$work/bad" >/dev/null 2>&1; then echo 'Checksum test failed'; exit 1; fi
export PGSSLMODE=disable
if bash scripts/backup-create.sh >/dev/null 2>&1; then echo 'TLS preflight test failed'; exit 1; fi
echo 'Mock-Tests erfolgreich: Backup, Bereinigung, Prüfsumme und TLS.'
