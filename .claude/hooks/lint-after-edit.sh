#!/usr/bin/env bash
# PostToolUse-Hook: lintet nach Edits die geänderte JS/TS-Datei.
# Grund: Es gibt aktuell keine CI-Lint-Prüfung für dieses Projekt (kein Lint-Step in
# .github/workflows) – ohne diesen Hook fallen Lint-Fehler erst beim manuellen
# `npm run lint` oder gar erst im Vercel-Build auf.
# Bewusst nur die eine Datei statt `npm run lint` (ganzes Projekt): format-after-edit.sh
# hat sie direkt davor schon mit `eslint --fix` behandelt, hier werden nur noch die
# Restfehler gemeldet, die sich nicht automatisch beheben lassen. Projektweit bleibt
# `npm run lint` der Build-Check vor dem Push (CLAUDE.md).
set -uo pipefail

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')"

case "$file_path" in
  *.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs | *.mts | *.cts)
    ;;
  *)
    exit 0
    ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-.}"
cd "$project_dir" || exit 0

case "$file_path" in
  /*) abs_path="$file_path" ;;
  *) abs_path="$project_dir/$file_path" ;;
esac

# Nur existierende Dateien innerhalb des Projekts prüfen.
case "$abs_path" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac

[ -f "$abs_path" ] || exit 0

lint_output="$(npx eslint "$abs_path" 2>&1)"
lint_status=$?

if [ "$lint_status" -ne 0 ]; then
  # Exit 2 zeigt stderr Claude direkt an, damit der Lint-Fehler noch in derselben
  # Session behoben werden kann statt erst beim nächsten `npm run lint` aufzufallen.
  echo "$lint_output" >&2
  exit 2
fi

exit 0
