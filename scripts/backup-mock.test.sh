#!/usr/bin/env bash
set -euo pipefail
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin" "$work/snap" "$work/out" "$work/bad"
realnode=$(command -v node)
cat > "$work/bin/psql" <<'STUB'
#!/usr/bin/env bash
statement=''
while IFS= read -r query; do
  statement+="$query"
  [[ "$query" == *';' ]] || continue
  if [[ "$statement" == SELECT* && "$statement" != 'SELECT to_jsonb(value)::text FROM ('* ]]; then exit 1; fi
  case "$statement" in
    *pg_export_snapshot*) echo '"00000001-00000002-1"';;
    *current_setting*) echo '"17.6"';;
    *aclexplode*) echo '{"functions":[],"triggers":[],"constraints":[],"grants":[],"sequences":[]}' ;;
    *pg_class*) echo '[{"schema":"public","table":"profiles","rls":true,"forceRls":false}]';;
    *vault.secrets*) echo '0';;
    *count*profiles*) echo '2';;
    *pg_policies*) echo '[{"policyname":"erste"},{"policyname":"zweite"}]';;
    *json_agg*) echo '[]';;
    ROLLBACK*) exit 0;;
  esac
  statement=''
done
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
if [[ "$1" == backup ]]; then echo 'Privater-Testdateiname'; cp -R payload "$MOCK_SNAP/"; elif [[ "$1" == restore ]]; then cp -R "$MOCK_SNAP/payload" "$4/"; else exit 1; fi
STUB
cat > "$work/bin/aws" <<'STUB'
#!/usr/bin/env bash
case "$2" in
  list-buckets) echo '{"Buckets":[{"Name":"fcb-test-backup"}]}' ;;
  list-object-versions) echo '{"Versions":[]}' ;;
  list-multipart-uploads) echo '{"Uploads":[]}' ;;
  *) exit 1 ;;
esac
STUB
chmod +x "$work/bin/"*
touch "$work/pgpass" "$work/resticpass"
export PATH="$work/bin:$PATH" REAL_NODE="$realnode" MOCK_SNAP="$work/snap" TMPDIR="$work" PGHOST=db.abcdefghijklmnopqrst.supabase.co PGPORT=5432 PGUSER=test PGDATABASE=postgres PGPASSFILE="$work/pgpass" PGSSLMODE=verify-full BACKUP_PROJECT_REF=abcdefghijklmnopqrst SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co SUPABASE_SERVICE_ROLE_KEY=fixture RESTIC_PASSWORD_FILE="$work/resticpass" BACKUP_FREE_TIER_CONFIRMED=true BACKUP_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com BACKUP_S3_BUCKET=fcb-test-backup
export RESTIC_REPOSITORY="s3:${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}/fcb-website"
export BACKUP_POSTGRES_IMAGE="supabase/postgres@sha256:$(printf 'a%.0s' {1..64})"
output=$(bash scripts/backup-create.sh)
[[ "$output" != *Privater-Testdateiname* ]]
[[ -f "$work/snap/payload/backup.json" && ! -f "$work/snap/payload/database-private.log" ]]
"$realnode" -e 'const m = JSON.parse(require("node:fs").readFileSync(process.argv[1])); if(m.schemaVersion!==2 || m.tables[0].rows!==2 || m.policies.length!==2) process.exit(1);' "$work/snap/payload/backup.json"
[[ -z "$(find "$work" -mindepth 1 -maxdepth 1 -name 'tmp.*' -print -quit)" ]]
bash scripts/restore-verify.sh latest "$work/out" >/dev/null
printf 'corrupt' > "$work/snap/payload/objects/object"
if bash scripts/restore-verify.sh latest "$work/bad" >/dev/null 2>&1; then echo 'Checksum test failed'; exit 1; fi
export PGSSLMODE=disable
if bash scripts/backup-create.sh >/dev/null 2>&1; then echo 'TLS preflight test failed'; exit 1; fi
export PGSSLMODE=verify-full BACKUP_FREE_TIER_CONFIRMED=false
if bash scripts/backup-create.sh >/dev/null 2>&1; then echo 'Kostenfreigabe-Sperre fehlgeschlagen'; exit 1; fi
echo 'Mock-Tests erfolgreich: Readonly-Snapshot, privater Export, Kosten-Sperre, Bereinigung, Prüfsumme und TLS.'
