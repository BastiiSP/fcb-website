#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then echo 'Aufruf: restore-verify.sh SNAPSHOT LEERES_ZIELVERZEICHNIS' >&2; exit 1; fi
snapshot="$1"
destination="$2"
[[ "$snapshot" =~ ^([a-f0-9]{8,64}|latest)$ ]] || { echo 'Ungültige Snapshot-ID.' >&2; exit 1; }
[[ -d "$destination" && -z "$(ls -A "$destination")" ]] || { echo 'Zielverzeichnis muss vorhanden und leer sein.' >&2; exit 1; }
for command in restic sha256sum pg_restore; do
  command -v "$command" >/dev/null || { printf 'Programm fehlt: %s\n' "$command" >&2; exit 1; }
done
if ! restic restore "$snapshot" --target "$destination" --tag fcb-backup --host fcb-website > "$destination/restore-private.log" 2>&1; then
  echo 'Snapshot konnte nicht aus dem verschlüsselten Ziel geladen werden.' >&2; exit 1
fi
manifests=()
while IFS= read -r -d '' manifest; do manifests+=("$manifest"); done < <(find "$destination" -type f -name SHA256SUMS -print0)
[[ ${#manifests[@]} -eq 1 ]] || { echo 'Snapshot enthält kein eindeutiges Prüfmanifest.' >&2; exit 1; }
payload="$(dirname "${manifests[0]}")"
[[ -f "$payload/SHA256SUMS" && -f "$payload/backup.json" && -f "$payload/database.dump" && -f "$payload/storage.json" ]] || { echo 'Snapshot ist unvollständig.' >&2; exit 1; }
if ! (cd "$payload" && sha256sum --check SHA256SUMS) >> "$destination/restore-private.log" 2>&1; then echo 'Sicherungsprüfsummen stimmen nicht überein.' >&2; exit 1; fi
if ! pg_restore --list "$payload/database.dump" >> "$destination/restore-private.log" 2>&1; then echo 'Datenbankarchiv ist nicht lesbar.' >&2; exit 1; fi
printf 'Snapshot und Datenbankarchiv geprüft.\n'
if [[ "${BACKUP_ISOLATED_RESTORE:-false}" == true ]]; then
  node "$(dirname "${BASH_SOURCE[0]}")/restore-isolated.mjs" "$payload"
  exit
fi
echo 'Es wurden keine Daten eingespielt.'
