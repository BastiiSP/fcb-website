#!/usr/bin/env bash
# Absichtlich nur auf dem eigenen Rechner interaktiv ausführen, niemals in CI.
set +x
set -euo pipefail
unset GH_DEBUG GITHUB_TRACE GIT_TRACE GH_TRACE
export GH_HOST=github.com
umask 077
[[ -t 0 && -t 1 ]] || { echo 'Dieses Programm benötigt ein eigenes interaktives Terminal.' >&2; exit 1; }
for tool in gh node; do command -v "$tool" >/dev/null || { echo 'GitHub CLI und Node.js werden benötigt.' >&2; exit 1; }; done
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
private="$(mktemp -d)"
terminal_state="$(stty -g)"
trap 'stty "$terminal_state" 2>/dev/null || true; rm -rf -- "$private"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
repo=BastiiSP/fcb-website
if ! gh auth status --hostname github.com > "$private/auth.log" 2>&1; then
  echo 'GitHub-Anmeldung fehlt. Zuerst gh auth login --hostname github.com --git-protocol https --web ausführen.' >&2
  exit 1
fi
if [[ "$(gh api user --jq .login 2> "$private/identity.log")" != BastiiSP || "$(gh api "repos/$repo" --jq .permissions.admin 2> "$private/repo.log")" != true ]]; then
  echo 'Das bestätigte GitHub-Konto mit Administrationsrecht auf dem Zielrepository fehlt.' >&2; exit 1
fi
hidden() {
  local target="$1" prompt="$2" input=''
  printf '%s' "$prompt" >&2
  read -r input
  printf '\n' >&2
  printf -v "$target" '%s' "$input"
}
# Während des gesamten Dialogs ausschalten, auch zwischen Eingaben. So werden
# eingefügte, bereits wartende Folgezeilen nicht kurzzeitig sichtbar.
stty -echo
echo 'Dieser Helfer überträgt zehn Secrets ausschließlich nach BastiiSP/fcb-website.'
echo 'Eingaben werden nicht angezeigt. Keine Zahlungsmittel, Tarife oder Zeitpläne werden geändert.'
echo 'DB-postgres und service_role sind erhöhte Zugänge: Das Backup liest nur, die Schlüssel erlauben technisch mehr.'
echo 'Nur in das eigene bestätigte Repository übertragen und dessen Schreibzugriffe kontrollieren.'
hidden dbhost 'Offizieller Supabase-Direkt- oder Session-Pooler-Host: '
if [[ "$dbhost" == db.jktvmckqfklfziszfsxf.supabase.co ]]; then defaultuser=postgres
elif [[ "$dbhost" =~ ^[a-z0-9-]+\.pooler\.supabase\.com$ ]]; then defaultuser=postgres.jktvmckqfklfziszfsxf
else echo 'Der Datenbankhost ist nicht zulässig.' >&2; exit 1; fi
hidden dbport 'Session-Port [5432]: '
dbport="${dbport:-5432}"
[[ "$dbport" == 5432 ]] || { echo 'Für die Sicherung ausschließlich den Session-Port 5432 verwenden.' >&2; exit 1; }
hidden dbuser 'Datenbanknutzer [offizieller Standard für diesen Host]: '
dbuser="${dbuser:-$defaultuser}"
[[ "$dbuser" == "$defaultuser" ]] || { echo 'Datenbanknutzer passt nicht zum bestätigten Host.' >&2; exit 1; }
hidden dbpassword 'Bestehendes Datenbankpasswort, kein Reset: '
[[ -n "$dbpassword" ]] || { echo 'Datenbankpasswort fehlt.' >&2; exit 1; }
servicekey=''
if [[ -f "$root/.env.local" ]]; then
  servicekey="$(cd "$root" && node --input-type=module -e 'import { readServiceRoleKey } from "./scripts/backup-env.mjs"; try { process.stdout.write(await readServiceRoleKey(".env.local")); } catch { process.exitCode=1; }' 2> "$private/service.log")" || servicekey=''
fi
if [[ -z "$servicekey" ]]; then hidden servicekey 'Supabase service_role/Secret-Key des bestätigten Projekts: '; fi
[[ ${#servicekey} -ge 32 ]] || { echo 'Storage-Schlüssel fehlt.' >&2; exit 1; }
if ! printf '%s' "$servicekey" | (cd "$root" && node --input-type=module -e 'import { validateServiceRoleKey } from "./scripts/backup-env.mjs"; let value=""; for await (const chunk of process.stdin) value+=chunk; try { validateServiceRoleKey(value); } catch { process.exitCode=1; }') > "$private/validation.log" 2>&1; then
  echo 'Storage-Schlüssel gehört nicht zum bestätigten Projekt oder hat ein ungültiges Format.' >&2; exit 1
fi
hidden keyid 'B2-Anwendungsschlüssel-ID des privaten Backup-Buckets: '
hidden key 'B2-Anwendungsschlüssel, einmalig angezeigter Wert: '
[[ ${#keyid} -ge 8 && ${#key} -ge 16 ]] || { echo 'B2-Anwendungsschlüssel fehlt.' >&2; exit 1; }
echo 'Neues restic-Passwort zusätzlich außerhalb des Repositorys im Passwortmanager sichern.'
echo 'Ohne diese getrennte Wiederherstellungskopie ist ein Backup später nicht entschlüsselbar.'
hidden resticpassword 'Neues restic-Passwort mit mindestens 32 Zeichen: '
hidden resticrepeat 'restic-Passwort wiederholen: '
[[ ${#resticpassword} -ge 32 && "$resticpassword" == "$resticrepeat" ]] || { echo 'restic-Passwort ist zu kurz oder stimmt nicht überein.' >&2; exit 1; }
echo 'Festes B2-Ziel: privater EU-Bucket fcb-website-backups-jktvmckq.'
read -r -p 'Jetzt zehn Secrets übertragen? Zur Bestätigung WEITER eingeben: ' confirmation
[[ "$confirmation" == WEITER ]] || { echo 'Ohne Übertragung beendet.'; exit 0; }
count=0
save() {
  local name="$1" value="$2"
  if ! printf '%s' "$value" | gh secret set "$name" --repo "$repo" > "$private/transfer.log" 2>&1; then
    printf 'Übertragung von %s fehlgeschlagen. %s Secrets wurden zuvor übertragen. Keine Werte veröffentlicht.\n' "$name" "$count" >&2
    exit 1
  fi
  count=$((count+1))
}
save BACKUP_DB_HOST "$dbhost"
save BACKUP_DB_PORT "$dbport"
save BACKUP_DB_USER "$dbuser"
save BACKUP_DB_PASSWORD "$dbpassword"
save BACKUP_SUPABASE_SERVICE_ROLE_KEY "$servicekey"
save BACKUP_S3_ENDPOINT https://s3.eu-central-003.backblazeb2.com
save BACKUP_S3_BUCKET fcb-website-backups-jktvmckq
save BACKUP_S3_KEY_ID "$keyid"
save BACKUP_S3_KEY "$key"
save BACKUP_RESTIC_PASSWORD "$resticpassword"
unset dbpassword servicekey key resticpassword resticrepeat
echo 'Zehn Secrets übertragen. Keine Repository-Variable und kein Zeitplan aktiviert.'
echo 'Als Nächstes nach Kontoprüfung BACKUP_FREE_TIER_CONFIRMED setzen und nur preflight starten.'
