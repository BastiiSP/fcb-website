#!/usr/bin/env bash
# Nur synthetische Netzprobe. Es werden weder Backupdaten noch Zugangsdaten geladen.
set -Eeuo pipefail
image='supabase/postgres@sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
suffix="$(openssl rand -hex 12)"
anchor="fcb-probe-net-${suffix}"
guest="fcb-probe-db-${suffix}"
password="$(openssl rand -hex 32)"
private="$(mktemp -d)"
canary_pid=''
cleanup() {
  docker rm -f -v "$guest" "$anchor" >/dev/null 2>&1 || true
  if [[ -n "$canary_pid" ]]; then kill "$canary_pid" 2>/dev/null || true; wait "$canary_pid" 2>/dev/null || true; fi
  rm -rf "$private"
}
trap cleanup EXIT

# Der Host-Canary liefert nur feste synthetische Bytes und wird vor dem
# Negativtest von der Hostseite aus positiv geprüft.
node -e 'const h=require("node:http"); const s=h.createServer((_,r)=>r.end("canary")); s.listen(0,"0.0.0.0",()=>console.log(s.address().port));' >"$private/port" &
canary_pid=$!
for ((attempt=0; attempt<50; attempt++)); do [[ -s "$private/port" ]] && break; sleep 0.1; done
canary_port="$(cat "$private/port")"
[[ "$canary_port" =~ ^[0-9]+$ ]]
host_ip="$(node -e 'const o=require("node:os");const a=Object.values(o.networkInterfaces()).flat().find(x=>x.family==="IPv4"&&!x.internal);if(!a)process.exit(1);process.stdout.write(a.address)')"
node -e 'const q=require("node:http").get({host:process.argv[1],port:Number(process.argv[2]),timeout:3000},r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>process.exit(r.statusCode===200&&b==="canary"?0:1))});q.on("timeout",()=>q.destroy());q.on("error",()=>process.exit(1))' "$host_ip" "$canary_port"

docker run -d --name "$anchor" --network none --entrypoint sh "$image" -c 'exec sleep 300' >/dev/null
anchor_id="$(docker inspect --format '{{.Id}}' "$anchor")"
[[ "$anchor_id" =~ ^[a-f0-9]{64}$ ]]
docker run -d --name "$guest" --network "container:${anchor_id}" -e "POSTGRES_PASSWORD=${password}" "$image" >/dev/null
unset password
[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$anchor")" == none ]]
[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$guest")" == "container:${anchor_id}" ]]
[[ "$(docker exec "$anchor" readlink /proc/self/ns/net)" == "$(docker exec "$guest" readlink /proc/self/ns/net)" ]]

# Ein gemeinsamer Namespace besitzt nur lo und keine IPv4-Route. Damit können
# weder Host-Gateway noch externe Ziele auch dann erreicht werden, wenn eine
# aufgelöste IP oder ein Eintrag in /etc/hosts bekannt ist.
check_namespace() {
  local container="$1"
  [[ "$(docker exec "$container" sh -c 'ls -1 /sys/class/net')" == lo ]]
  docker exec "$container" sh -c "awk 'NR > 1 { exit 1 }' /proc/net/route"
  docker exec "$container" sh -c 'command -v timeout >/dev/null && command -v bash >/dev/null'
  for target in "1.1.1.1:80" "169.254.169.254:80" "172.17.0.1:80" "${host_ip}:${canary_port}" "1.1.1.1:53"; do
    local status=0
    if docker exec "$container" timeout 3 bash -c 'exec 3<>/dev/tcp/${1%:*}/${1##*:}' bash "$target" >/dev/null 2>&1; then
      return 1
    else
      status=$?
    fi
    # 1 = Verbindungsfehler, 124 = Zeitlimit. Fehler des Prüfwerkzeugs sind kein Nachweis.
    [[ "$status" == 1 || "$status" == 124 ]]
  done
  local status=0
  if docker exec "$container" timeout 3 bash -c 'printf x > /dev/udp/1.1.1.1/53' >/dev/null 2>&1; then
    return 1
  else
    status=$?
  fi
  [[ "$status" == 1 || "$status" == 124 ]]
  status=0
  if docker exec "$container" timeout 3 bash -c 'exec 3<>/dev/tcp/2606:4700:4700::1111/53' >/dev/null 2>&1; then
    return 1
  else
    status=$?
  fi
  [[ "$status" == 1 || "$status" == 124 ]]
}
check_namespace "$anchor"
check_namespace "$guest"

ready=false
for ((attempt=0; attempt<90; attempt++)); do
  if docker exec "$anchor" pg_isready -q -h 127.0.0.1 -p 5432; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
for container in "$anchor" "$guest"; do
  docker exec "$container" timeout 3 bash -c 'exec 3<>/dev/tcp/127.0.0.1/5432'
done
check_namespace "$anchor"
check_namespace "$guest"
echo 'Synthetische Netzprobe erfolgreich: gemeinsames Loopback, keine externen Schnittstellen oder IPv4-Routen.'
