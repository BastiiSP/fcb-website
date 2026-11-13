#!/usr/bin/env bash
# Einmaliger synthetischer Resolver. Die Ausgabe muss unabhängig geprüft und
# anschließend fest übernommen werden; für echte Restores niemals Tags nutzen.
set -Eeuo pipefail
for image in \
  'supabase/gotrue:v2.197.0' \
  'postgrest/postgrest:v14.18' \
  'supabase/storage-api:v1.89.12' \
  'mcr.microsoft.com/playwright:v1.61.0-noble'; do
  docker pull --platform linux/amd64 "$image" >/dev/null
  repository="${image%:*}"
  docker image inspect --format '{{json .RepoDigests}}' "$image" | node -e '
    const repo = process.argv[1]; let input = "";
    process.stdin.setEncoding("utf8"); process.stdin.on("data", x => input += x);
    process.stdin.on("end", () => {
      const prefix = repo + "@sha256:";
      const values = JSON.parse(input).filter(x => x.startsWith(prefix) && /^[a-f0-9]{64}$/.test(x.slice(prefix.length)));
      if (values.length !== 1) process.exit(1);
      console.log(values[0]);
    });
  ' "$repository"
done
