#!/usr/bin/env bash
# Ausschließlich erfundene Daten, ohne Anbieterzugang oder Produktionsnetz.
set -euo pipefail
umask 077
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
private="$(mktemp -d)"
source_name="fcb-synthetic-${RANDOM}-${RANDOM}"
cleanup() { docker rm -f -v "$source_name" >/dev/null 2>&1 || true; rm -rf "$private"; }
trap cleanup EXIT
export TMPDIR="$private"
docker pull supabase/postgres:17.6.1.063 > "$private/image.log" 2>&1
export BACKUP_POSTGRES_IMAGE="$(docker image inspect --format '{{index .RepoDigests 0}}' supabase/postgres:17.6.1.063)"
[[ "$BACKUP_POSTGRES_IMAGE" =~ ^supabase/postgres@sha256:[a-f0-9]{64}$ ]]
docker run -d --name "$source_name" --network none --memory 2g --cpus 2 \
  --mount "type=bind,source=$private,target=$private" -e POSTGRES_PASSWORD=synthetic-only-password \
  "$BACKUP_POSTGRES_IMAGE" > "$private/container.log"
ready=false
for attempt in {1..90}; do
  if docker exec "$source_name" pg_isready -U supabase_admin >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$source_name")" == none ]]
query() { docker exec -i "$source_name" psql -XqAt -v ON_ERROR_STOP=1 -U supabase_admin -d "${1:-synthetic}"; }
printf 'CREATE DATABASE synthetic TEMPLATE template0;' | query postgres
query < "$root/scripts/fixtures/backup-synthetic.sql"
mkdir -m 700 "$private/bin" "$private/payload"
# Nur die Transportgrenze wird lokal ersetzt, die Export- und Restoremodule bleiben unverändert.
for tool in psql pg_dump; do
  cat > "$private/bin/$tool" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
exec docker exec -i -e PGOPTIONS "$SYNTHETIC_SOURCE" "$(basename "$0")" -U supabase_admin -d synthetic "$@"
WRAPPER
  chmod 700 "$private/bin/$tool"
done
export SYNTHETIC_SOURCE="$source_name" PATH="$private/bin:$PATH"
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=600000'
export BACKUP_PROJECT_REF=syntheticfixtureonly0
before="$(printf 'SELECT count(*) FROM public.synthetic_items;' | query)"
node "$root/scripts/backup-database.mjs" "$private/payload" || { cat "$private/payload/database-private.log"; exit 1; }
after="$(printf 'SELECT count(*) FROM public.synthetic_items;' | query)"
[[ "$before" == 2 && "$after" == "$before" ]]
node --input-type=module - "$private/payload" <<'JS'
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const root=process.argv[2], bytes=Buffer.from('Ausschließlich synthetischer Storage-Inhalt.\n');
const file=createHash('sha256').update('synthetic/fixture.txt').digest('hex');
await mkdir(`${root}/objects`,{mode:0o700});
await writeFile(`${root}/objects/${file}`,bytes);
await writeFile(`${root}/storage.json`,JSON.stringify({objects:[{id:'00000000-0000-4000-8000-000000000001',bucket:'synthetic',name:'fixture.txt',file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]}));
const manifest=JSON.parse(await readFile(`${root}/backup.json`));
if(manifest.tables.find(x=>x.schema==='public'&&x.table==='synthetic_items')?.rows!==2 || manifest.policies.length!==1) throw Error('Synthetischer Vertrag fehlt.');
JS
export RESTIC_REPOSITORY="$private/restic" RESTIC_PASSWORD=synthetic-only-restic-password
restic init > "$private/restic.log" 2>&1
(cd "$private" && restic backup payload >> "$private/restic.log" 2>&1)
mkdir -m 700 "$private/recovered"
restic restore latest --target "$private/recovered" >> "$private/restic.log" 2>&1
cmp "$private/payload/database.dump" "$private/recovered/payload/database.dump"
node "$root/scripts/restore-isolated.mjs" "$private/recovered/payload" || { cat "$private/recovered/payload/restore-private.log"; exit 1; }
node --input-type=module - "$private/recovered/payload/restore-proof.json" <<'JS'
import {readFile} from 'node:fs/promises';
const proof=JSON.parse(await readFile(process.argv[2]));
if(!proof.databaseRestored||!proof.catalogCompared||proof.network!=='none'||proof.filesCompared!==1||proof.policiesCompared!==1) throw Error('Restore-Nachweis unvollständig.');
console.log('Synthetischer PostgreSQL-17-Export, verschlüsselter lokaler restic-Roundtrip und netzwerkisolierter Restore geprüft.');
JS
