#!/usr/bin/env bash
# Einmalige Einrichtung nach erfolgreichem main-Lauf. Vorhandene Regeln werden
# bewusst nicht ersetzt. Ohne --apply erfolgen ausschließlich lesende Abfragen.
# API-Vertrag: https://docs.github.com/en/rest/branches/branch-protection
set -euo pipefail

mode="${1:---check}"
if [[ $# -gt 1 || ( "$mode" != "--check" && "$mode" != "--apply" ) ]]; then
  printf 'Aufruf: bash scripts/configure-main-protection.sh [--check|--apply]\n' >&2
  exit 2
fi

for dependency in gh jq; do
  command -v "$dependency" >/dev/null || {
    printf 'Benötigtes Programm fehlt: %s\n' "$dependency" >&2
    exit 1
  }
done

repo='BastiiSP/fcb-website'
api="repos/$repo"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
export GH_PAGER=cat

fail() {
  printf 'Abbruch: %s\n' "$1" >&2
  exit 1
}

api_get() {
  gh api --hostname github.com --method GET \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
}

assert_unprotected() {
  api_get "$api/branches/main" > "$work_dir/branch.json"
  jq -e '.name == "main" and .protected == false' \
    "$work_dir/branch.json" >/dev/null || fail 'main ist bereits geschützt oder der Branchstatus ist unklar. Bestehende Regeln manuell prüfen.'

  # Auch ein nicht lesbarer Schutz darf nicht als fehlender Schutz gelten.
  if api_get "$api/branches/main/protection" > "$work_dir/protection.json" 2> "$work_dir/protection.err"; then
    fail 'Branchschutz existiert bereits und wird nicht überschrieben.'
  fi
  jq -e '.message == "Branch not protected"' "$work_dir/protection.json" >/dev/null \
    || fail 'Fehlender Branchschutz konnte mit Adminzugriff nicht eindeutig bestätigt werden.'

  api_get --paginate --slurp "$api/rulesets?includes_parents=true&per_page=100" > "$work_dir/rulesets.json"
  jq -e 'all(.[]; type == "array" and length == 0)' "$work_dir/rulesets.json" >/dev/null \
    || fail 'Rulesets existieren bereits. Vor einer zusätzlichen Regel deren Wirkung manuell prüfen.'
}

gh auth status --hostname github.com >/dev/null \
  || fail 'GitHub-Anmeldung fehlt. Zuerst gh auth login --hostname github.com im eigenen Terminal ausführen.'
api_get "$api" > "$work_dir/repo.json"
jq -e '.full_name == "BastiiSP/fcb-website" and .permissions.admin == true and .archived == false' \
  "$work_dir/repo.json" >/dev/null || fail 'Administrationszugriff auf das aktive Zielrepository fehlt.'

assert_unprotected
head_sha="$(jq -er '.commit.sha' "$work_dir/branch.json")"
jq -n '["Lint", "TypeScript", "Unit-Tests", "Produktionsbuild", "Migrationen und Schema-Vertrag"]' > "$work_dir/names.json"
api_get --paginate --slurp "$api/commits/$head_sha/check-runs?filter=latest&per_page=100" > "$work_dir/checks.json"

# Bei mehreren Check-Suites zählt je Name ausschließlich der neueste Lauf der
# erwarteten App. Ältere erfolgreiche Läufe dürfen neue Fehler nicht verdecken.
jq -e --arg sha "$head_sha" --slurpfile names "$work_dir/names.json" '
  [.[].check_runs[] | select(.app.id == 15368)] as $runs |
  all($names[0][]; . as $name |
    [$runs[] | select(.name == $name)] | sort_by(.id) | last |
    . != null and .head_sha == $sha and .status == "completed" and .conclusion == "success")
' "$work_dir/checks.json" >/dev/null \
  || fail 'Alle fünf Pflichtchecks müssen am aktuellen main-Commit erfolgreich abgeschlossen sein (GitHub Actions, App 15368).'

jq -n --slurpfile names "$work_dir/names.json" '{
  required_status_checks: {
    strict: true,
    checks: [$names[0][] | {context: ., app_id: 15368}]
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  required_conversation_resolution: true,
  block_creations: false,
  lock_branch: false,
  allow_fork_syncing: false
}' > "$work_dir/payload.json"

printf 'Vorprüfung erfolgreich: %s, main %s, fünf aktuelle Checks grün.\n' "$repo" "$head_sha"
if [[ "$mode" == '--check' ]]; then
  printf 'Keine Änderung vorgenommen. Aktivieren mit: bash scripts/configure-main-protection.sh --apply\n'
  exit 0
fi

# Direkt vor dem einzigen Schreibaufruf erneut prüfen. GitHub bietet für diese
# Konfiguration keine atomare Kopplung an den Branch-SHA. Währenddessen keine
# parallelen Merges oder Einstellungsänderungen vornehmen.
assert_unprotected
[[ "$(jq -er '.commit.sha' "$work_dir/branch.json")" == "$head_sha" ]] \
  || fail 'main hat sich während der Vorprüfung geändert. Nach neuen grünen Checks erneut starten.'

gh api --hostname github.com --method PUT \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "$api/branches/main/protection" --input "$work_dir/payload.json" > "$work_dir/put.json"

# Die PUT-Antwort allein gilt nicht als Nachweis. Gespeicherte Regel neu lesen.
api_get "$api/branches/main/protection" > "$work_dir/readback.json"
jq -e --slurpfile names "$work_dir/names.json" '
  .required_status_checks.strict == true and
  ([.required_status_checks.checks[] | {context, app_id}] | sort_by(.context)) ==
    ([$names[0][] | {context: ., app_id: 15368}] | sort_by(.context)) and
  (.required_status_checks.contexts | sort) == ($names[0] | sort) and
  .enforce_admins.enabled == true and
  .required_pull_request_reviews.required_approving_review_count == 0 and
  .required_pull_request_reviews.dismiss_stale_reviews == true and
  .required_pull_request_reviews.require_code_owner_reviews == false and
  .required_pull_request_reviews.require_last_push_approval == false and
  ([.required_pull_request_reviews.bypass_pull_request_allowances // {} | .users[]?, .teams[]?, .apps[]?] | length) == 0 and
  .restrictions == null and
  .required_linear_history.enabled == false and
  .allow_force_pushes.enabled == false and
  .allow_deletions.enabled == false and
  .required_conversation_resolution.enabled == true and
  .block_creations.enabled == false and
  .lock_branch.enabled == false and
  .allow_fork_syncing.enabled == false
' "$work_dir/readback.json" >/dev/null \
  || fail 'Schreibaufruf erfolgt, aber Readback weicht vom Ziel ab. Nicht erneut überschreiben; GitHub-Einstellungen manuell prüfen.'

printf 'Branchschutz gespeichert und per GET bestätigt: PR erforderlich, 0 Pflichtgenehmigungen, fünf Pflichtchecks, aktueller Branch, Admins eingeschlossen, Gespräche gelöst, kein Force-Push oder Löschen.\n'
printf 'Manuell prüfen: https://github.com/%s/settings/branches\n' "$repo"
