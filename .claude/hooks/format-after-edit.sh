#!/usr/bin/env bash
# PostToolUse-Hook: formatiert die geänderte Datei automatisch nach Write/Edit.
# Grund: Es gibt kein Prettier in diesem Projekt (kein "format"-Script, kein
# .prettierrc, kein prettier in devDependencies) – ESLint (next/core-web-vitals,
# next/typescript, eslint.config.mjs) ist die einzige vorhandene Fix-Instanz. Der
# Hook wendet `eslint --fix` gezielt auf die geänderte Datei an (nicht das ganze
# Projekt wie lint-after-edit.sh) und blockiert nie – ein Formatierungsfehler soll
# nie einen Edit verhindern.
set -uo pipefail

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')"

[ -z "$file_path" ] && exit 0

case "$file_path" in
  *.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs | *.mts | *.cts)
    ;;
  *)
    exit 0
    ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-.}"
cd "$project_dir" 2>/dev/null || exit 0

case "$file_path" in
  /*) abs_path="$file_path" ;;
  *) abs_path="$project_dir/$file_path" ;;
esac

# Nur Dateien innerhalb des Projekts formatieren, die tatsächlich existieren.
case "$abs_path" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac

[ -f "$abs_path" ] || exit 0

npx eslint --fix "$abs_path" 2>/dev/null || true

exit 0
