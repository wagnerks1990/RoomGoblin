#!/usr/bin/env bash
set -euo pipefail

image="${1:-classroom-control-hub:test}"
suffix="${GITHUB_RUN_ID:-$$}-${RANDOM}"
network="roomgoblin-integration-smoke-${suffix}"
server="roomgoblin-net-server-${suffix}"

cleanup() {
  docker rm -f "$server" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create   --driver bridge   --label org.roomgoblin.network=integration   "$network" >/dev/null

driver="$(docker network inspect -f '{{.Driver}}' "$network")"
label="$(docker network inspect -f '{{index .Labels "org.roomgoblin.network"}}' "$network")"
[[ "$driver" == "bridge" ]]
[[ "$label" == "integration" ]]

docker run -d --name "$server" --network "$network"   --entrypoint node "$image"   -e 'require("net").createServer(socket=>socket.end("ok")).listen(18830,"0.0.0.0")' >/dev/null

for _ in $(seq 1 20); do
  if docker run --rm --network "$network" --entrypoint node "$image"     -e 'const net=require("net");const host=process.argv[1];const socket=net.createConnection({host,port:18830});let body="";socket.setTimeout(2000);socket.on("data",chunk=>body+=chunk);socket.on("end",()=>process.exit(body==="ok"?0:2));socket.on("timeout",()=>process.exit(3));socket.on("error",()=>process.exit(4));'     "$server"; then
    exit 0
  fi
  sleep 1
done

echo "RoomGoblin integration bridge DNS/connectivity smoke test failed" >&2
exit 1
