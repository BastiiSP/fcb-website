#!/usr/bin/env bash
set -euo pipefail

# Öffentlicher Pooler-Endpunkt. Die TLS-Prüfung endet vor PostgreSQL-Startup und Authentifizierung.
host='aws-1-eu-central-1.pooler.supabase.com'
root="$(cd "$(dirname "$0")/.." && pwd)"
certificate="$root/scripts/certificates/supabase-prod-ca-2021.crt"
[[ "${BACKUP_POSTGRES_IMAGE:-}" =~ ^supabase/postgres@sha256:[a-f0-9]{64}$ ]] || { echo 'Unveränderliche PostgreSQL-Imagekennung fehlt.'; exit 1; }
[[ "$(sha256sum "$certificate" | cut -d ' ' -f 1)" == '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7' ]] || { echo 'Supabase-CA stimmt nicht mit dem geprüften Original überein.'; exit 1; }

private="$(mktemp -d)"
trap 'rm -rf -- "$private"' EXIT

probe() {
  local label="$1"; shift
  local result=0
  # OpenSSL führt nur den PostgreSQL SSLRequest und den TLS-Handshake durch.
  timeout 30 docker run --rm -i --network host \
    --mount "type=bind,source=$certificate,target=/probe-ca.crt,readonly" \
    --entrypoint openssl "$BACKUP_POSTGRES_IMAGE" s_client -starttls postgres \
    -connect "$host:5432" -servername "$host" -verify_hostname "$host" \
    -verify_return_error "$@" </dev/null >"$private/result" 2>&1 || result=$?
  if [[ "$result" == 0 ]]; then
    echo "$label: TLS und Hostname bestätigt."
  elif [[ "$result" == 124 ]]; then
    echo "$label: Zeitüberschreitung."
  elif grep -Eqi 'certificate verify failed|verify error|unable to get.*issuer|self.signed certificate' "$private/result"; then
    echo "$label: Zertifikatsprüfung fehlgeschlagen."
  elif grep -Eqi 'unexpected eof|connection reset|connection refused|no peer certificate|SSL routines' "$private/result"; then
    echo "$label: TLS-Verbindung oder Handshake fehlgeschlagen."
  else
    echo "$label: Prüfung fehlgeschlagen (Exit $result)."
  fi
  return "$result"
}

system=0
supabase=0
probe 'System-CA' || system=$?
probe 'Supabase-CA' -no-CApath -CAfile /probe-ca.crt || supabase=$?
[[ "$system" == 0 || "$supabase" == 0 ]]
