#!/usr/bin/env bash
set -Eeuo pipefail
ROOMGOBLIN_UPDATE_SOURCE=main

# install.sh may replace the installed runner while this transaction is active.
# Execute a private stable copy so Bash never reads a partially replaced script.
if [[ "${ROOMGOBLIN_RUNNER_SNAPSHOT:-}" != "${BASH_SOURCE[0]}" ]]; then
  snapshot="$(mktemp /run/classroom-hub-updater.XXXXXX)"
  cp "${BASH_SOURCE[0]}" "$snapshot"
  chmod 0700 "$snapshot"
  export ROOMGOBLIN_RUNNER_SNAPSHOT="$snapshot"
  exec bash "$snapshot" "$@"
fi
trap 'rm -f "$ROOMGOBLIN_RUNNER_SNAPSHOT"' EXIT

HUB_ROOT="${CLASSROOM_HUB_DIR:-/opt/classroom-hub}"
STATE_DIR=/var/lib/classroom-hub
STATE_FILE="$STATE_DIR/app-update-status.json"
REQUEST_FILE="$STATE_DIR/app-update-request.json"
LOCK_FILE=/run/classroom-control-hub-appliance-mutation.lock
mkdir -p "$STATE_DIR"
source "$HUB_ROOT/deploy/image-readiness.sh"

write_state(){
  local phase="$1" message="$2" ok="${3:-null}"
  PHASE="$phase" MESSAGE="$message" OK="$ok" STATE_FILE="$STATE_FILE" python3 - <<'PY'
import datetime,json,os
p=os.environ['STATE_FILE']
try: state=json.load(open(p))
except Exception: state={}
raw=os.environ.get('OK','null')
state.update({'phase':os.environ['PHASE'],'message':os.environ['MESSAGE'],'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ok':None if raw=='null' else raw=='true'})
with open(p+'.tmp','w') as f: json.dump(state,f,indent=2)
os.replace(p+'.tmp',p)
PY
}

set_state_fields(){
  STATE_FILE="$STATE_FILE" python3 - "$@" <<'PY'
import json,os,sys
p=os.environ['STATE_FILE']
try: state=json.load(open(p))
except Exception: state={}
for item in sys.argv[1:]:
    key,value=item.split('=',1)
    if value=='true': value=True
    elif value=='false': value=False
    elif value=='null': value=None
    state[key]=value
with open(p+'.tmp','w') as f: json.dump(state,f,indent=2)
os.replace(p+'.tmp',p)
PY
}

set_request_fields(){
  REQUEST_FILE="$REQUEST_FILE" python3 - "$@" <<'PY'
import json,os,sys
p=os.environ['REQUEST_FILE']
request=json.load(open(p))
for item in sys.argv[1:]:
    key,value=item.split('=',1)
    request[key]=value
with open(p+'.tmp','w') as f:
    json.dump(request,f,indent=2); f.flush(); os.fsync(f.fileno())
os.chmod(p+'.tmp',0o600)
os.replace(p+'.tmp',p)
fd=os.open(os.path.dirname(p),os.O_RDONLY); os.fsync(fd); os.close(fd)
PY
}

set_image_tag(){
  local tag="$1"
  [[ "$tag" =~ ^[A-Za-z0-9._-]{1,180}$ ]] || return 1
  if grep -q '^CLASSROOM_CONTROL_HUB_TAG=' .env; then
    sed -i "s/^CLASSROOM_CONTROL_HUB_TAG=.*/CLASSROOM_CONTROL_HUB_TAG=${tag}/" .env
  else
    printf 'CLASSROOM_CONTROL_HUB_TAG=%s\n' "$tag" >> .env
  fi
  chmod 0600 .env
  export CLASSROOM_CONTROL_HUB_TAG="$tag"
  set_component_tag ROOMGOBLIN_HUB_TAG "$tag"
  set_component_tag ROOMGOBLIN_MAINTENANCE_TAG "$tag"
}

set_component_tag(){
  local key="$1" tag="$2"
  [[ "$key" == ROOMGOBLIN_HUB_TAG || "$key" == ROOMGOBLIN_MAINTENANCE_TAG ]] || return 1
  [[ "$tag" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || return 1
  KEY="$key" TAG="$tag" python3 - <<'PYENV'
import os
from pathlib import Path
p=Path('.env'); key=os.environ['KEY']; value=os.environ['TAG']
lines=[line for line in p.read_text().splitlines() if not line.startswith(key+'=')]
temp=p.with_suffix('.update-tmp'); temp.write_text('\n'.join(lines+[key+'='+value])+'\n')
temp.chmod(0o600); temp.replace(p)
PYENV
  export "$key=$tag"
}

activate_recovery_pair(){
  local hub="$1" maintenance="$2"
  # Dedicated recovery tags cannot overwrite a release/sha alias with another image.
  set_image_tag "recovery-${hub#sha256:}"
  set_component_tag ROOMGOBLIN_HUB_TAG "recovery-${hub#sha256:}"
  set_component_tag ROOMGOBLIN_MAINTENANCE_TAG "recovery-${maintenance#sha256:}"
  activate_image_id "$hub" classroom-hub
  activate_image_id "$maintenance" maintenance-agent
}

health_check(){
  local expected="$1"
  for _ in $(seq 1 "${HEALTH_ATTEMPTS:-90}"); do
    if docker compose exec -T classroom-hub node -e "const port=Number(process.env.PORT||3000);let host=process.env.BIND_ADDRESS||'127.0.0.1';if(host==='0.0.0.0')host='127.0.0.1';if(host==='::'||host==='[::]')host='[::1]';if(host.includes(':')&&!host.startsWith('['))host='['+host+']';fetch('http://'+host+':'+port+'/health',{signal:AbortSignal.timeout(10000)}).then(async r=>{const j=await r.json();if(!r.ok||!j.ok||(process.argv[1]&&j.version!==process.argv[1]))process.exit(1)}).catch(()=>process.exit(1))" "$expected" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

adb_storage_check(){
  docker volume inspect classroom-control-hub-android-adb >/dev/null || return 1
  # Maintenance intentionally mounts the ADB identity store read-only; host-side layout repair owns mutations.
  docker compose exec -T maintenance-agent sh -lc 'test -r /managed/classroom-hub/data/android-tv/.android' || return 1
  docker compose exec -T maintenance-agent sh -lc 'test ! -e /managed/classroom-hub/data/android-tv/devices.json || test -r /managed/classroom-hub/data/android-tv/devices.json' || return 1
}

wait_maintenance(){
  for _ in $(seq 1 30); do
    if docker compose exec -T maintenance-agent node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3010)+'/health',{headers:{'x-maintenance-token':process.env.MAINTENANCE_TOKEN},signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok||!(await r.json()).ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

appliance_health_check(){
  local expected="$1"
  health_check "$expected" || return 1
  docker compose ps --status running --services | grep -qx classroom-hub || return 1
  docker compose ps --status running --services | grep -qx maintenance-agent || return 1
  docker compose exec -T maintenance-agent node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3010)+'/health',{headers:{'x-maintenance-token':process.env.MAINTENANCE_TOKEN},signal:AbortSignal.timeout(10000)}).then(r=>r.json()).then(j=>{if(!j.ok||j.version!==process.argv[1]||!j.hostAgent?.ok||j.hostAgent.version!==process.argv[1])process.exit(1)}).catch(()=>process.exit(1))" "$expected" || return 1
  adb_storage_check || return 1
}

capture_recovery_image(){
  local container="$1" label="$2" id ref
  id="$(docker inspect --format '{{.Image}}' "$container")"
  [[ "$id" =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
  ref="classroom-control-hub-recovery:${label%%-*}-${id#sha256:}"
  docker image tag "$id" "$ref"
  printf '%s' "$id"
}

activate_image_id(){
  local id="$1" service="$2" ref
  [[ "$id" =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
  docker image inspect "$id" >/dev/null
  ref="$(docker compose config --format json | SERVICE="$service" python3 -c 'import json,os,sys; print(json.load(sys.stdin)["services"][os.environ["SERVICE"]]["image"])')"
  [[ -n "$ref" ]] || return 1
  docker image tag "$id" "$ref"
}

ensure_adb_runtime_layout(){
  local value adb_mount
  adb_mount="$(docker volume inspect classroom-control-hub-android-adb --format '{{.Mountpoint}}')" || return 1
  [[ "$adb_mount" == "${DOCKER_VOLUMES_ROOT:-/var/lib/docker/volumes}/classroom-control-hub-android-adb/_data" && -d "$adb_mount" && ! -L "$adb_mount" ]] || return 1
  chmod 0750 "$adb_mount" || return 1
  chown 10001:10001 "$adb_mount" || return 1
  # Devices may never have been paired. Preserve an empty identity store.
  if [[ ! -e "$adb_mount/adbkey" && ! -L "$adb_mount/adbkey" && ! -e "$adb_mount/adbkey.pub" && ! -L "$adb_mount/adbkey.pub" ]]; then
    return 0
  fi
  # Validate the whole pair before changing either key.
  for value in adbkey adbkey.pub; do
    [[ -f "$adb_mount/$value" && ! -L "$adb_mount/$value" ]] || return 1
  done
  for value in adbkey adbkey.pub; do
    chown 10001:10001 "$adb_mount/$value" || return 1
    chmod 0640 "$adb_mount/$value" || return 1
  done
}

ensure_runtime_layout(){
  local value
  install -d -m 0750 -o root -g root /var/lib/classroom-hub
  ensure_adb_runtime_layout || return 1
  install -d -m 0770 -o root -g 10001 "$HUB_ROOT/data"
  install -d -m 0700 -o root -g 10001 "$HUB_ROOT/data/backups"
  install -d -m 2770 -o root -g 10001 "$HUB_ROOT/data/android-tv"
  if [[ -f "$HUB_ROOT/data/android-tv/devices.json" ]]; then
    chown root:10001 "$HUB_ROOT/data/android-tv/devices.json"
    chmod 0660 "$HUB_ROOT/data/android-tv/devices.json"
  fi
  [[ -f .env ]] || cp .env.example .env
  value="$(sed -n 's/^MAINTENANCE_TOKEN=//p' .env | tail -n 1)"
  if [[ -z "$value" ]]; then
    value="$(openssl rand -hex 32)"
    if grep -q '^MAINTENANCE_TOKEN=' .env; then sed -i "s/^MAINTENANCE_TOKEN=.*/MAINTENANCE_TOKEN=${value}/" .env; else printf 'MAINTENANCE_TOKEN=%s\n' "$value" >> .env; fi
  fi
  sed -i '/^HUB_TLS_HOST=/d;/^HUB_HTTPS_PORT=/d;/^HUB_HTTP_PORT=/d' .env
  # Preserve explicit loopback/LAN bindings rather than widening host exposure.
  if ! grep -q '^HUB_BIND_ADDRESS=' .env; then echo 'HUB_BIND_ADDRESS=0.0.0.0' >> .env; fi
  value="$(sed -n 's/^TRUST_PROXY_HOPS=//p' .env | tail -n 1)"
  if [[ -z "$value" ]]; then
    echo 'TRUST_PROXY_HOPS=0' >> .env
  elif [[ ! "$value" =~ ^[0-9]+$ || "$value" -gt 8 ]]; then
    echo "TRUST_PROXY_HOPS must be an integer between 0 and 8" >&2
    return 1
  fi
  chmod 0600 .env
  install -d -m 0750 -o root -g 10001 /etc/classroom-control-hub
  if [[ ! -s /etc/classroom-control-hub/master.key && -s /etc/classroom-hub/master.key ]]; then
    install -m 0640 -o root -g 10001 /etc/classroom-hub/master.key /etc/classroom-control-hub/master.key
  fi
  if [[ ! -s /etc/classroom-control-hub/master.key ]]; then
    openssl rand -hex 32 > /etc/classroom-control-hub/master.key
    chown root:10001 /etc/classroom-control-hub/master.key
    chmod 0640 /etc/classroom-control-hub/master.key
  fi
}

refresh_host_agent(){
  if [[ "${PLAN_FULL:-true}" == true ]]; then
  # This root oneshot is intentionally outside the Host Agent mount namespace.
  # Install/verify cloudflared here; the Host Agent itself must never run apt.
  bash "$HUB_ROOT/deploy/install-cloudflared-host.sh"
  install -D -m 0644 "$HUB_ROOT/host-agent/classroom-control-hub-host-agent.service" /etc/systemd/system/classroom-hub-host-agent.service
  if [[ "$HUB_ROOT" != /opt/classroom-hub ]]; then sed -i "s#/opt/classroom-hub#$HUB_ROOT#g" /etc/systemd/system/classroom-hub-host-agent.service; fi
  sed -i "s#^Environment=HOST_SERVICES_DIR=.*#Environment=HOST_SERVICES_DIR=${HOST_SERVICES_DIR:-/opt/services}#" /etc/systemd/system/classroom-hub-host-agent.service
  sed -i "s#^Environment=HOST_BACKUP_DIR=.*#Environment=HOST_BACKUP_DIR=${HOST_BACKUP_DIR:-/opt/classroom-hub-backups}#" /etc/systemd/system/classroom-hub-host-agent.service
  sed -i "s#^Environment=DOCKER_VOLUMES_ROOT=.*#Environment=DOCKER_VOLUMES_ROOT=${DOCKER_VOLUMES_ROOT:-/var/lib/docker/volumes}#" /etc/systemd/system/classroom-hub-host-agent.service
  install -d -m 0700 -o root -g root /etc/cloudflared
  [[ -e /etc/systemd/system/cloudflared-roomgoblin.service ]] || install -m 0644 -o root -g root /dev/null /etc/systemd/system/cloudflared-roomgoblin.service
  sed -i "s#^ReadWritePaths=.*#ReadWritePaths=/run/classroom-control-hub $HUB_ROOT ${HOST_SERVICES_DIR:-/opt/services} ${HOST_BACKUP_DIR:-/opt/classroom-hub-backups} /etc/classroom-control-hub /etc/cloudflared /etc/systemd/system/cloudflared-roomgoblin.service /var/lib/classroom-hub ${DOCKER_VOLUMES_ROOT:-/var/lib/docker/volumes}#" /etc/systemd/system/classroom-hub-host-agent.service
  python3 -m py_compile "$HUB_ROOT/host-agent/server.py"
  systemctl daemon-reload
  fi
  systemctl restart classroom-hub-host-agent.service
}

restore_safety_backup(){
  local backup="$1" expected_sha="${2:-}"
  [[ -n "$backup" ]] || return 0
  if [[ -n "$expected_sha" ]]; then
    local actual_sha
    actual_sha="$(sha256sum "$HUB_ROOT/data/backups/$backup" | awk '{print $1}')"
    [[ "$actual_sha" == "$expected_sha" ]] || { echo "Safety backup checksum mismatch" >&2; return 1; }
  fi
  docker exec -i -e BACKUP_NAME="$backup" classroom-control-hub-maintenance node - <<'NODE'
const name=process.env.BACKUP_NAME,token=process.env.MAINTENANCE_TOKEN,port=process.env.PORT||3010;
fetch(`http://127.0.0.1:${port}/backup/${encodeURIComponent(name)}/restore`,{method:'POST',headers:{'content-type':'application/json','x-maintenance-token':token},body:JSON.stringify({mode:'configuration-data',confirm:'RESTORE'})})
  .then(async r=>{const text=await r.text();if(!r.ok)throw Error(text);console.log(text)})
  .catch(e=>{console.error(e.message);process.exit(1)});
NODE
}

advance_main_source(){
  # Never reset/delete legacy or unrelated branches. The preflight has verified
  # both HEAD and any existing main can fast-forward to the selected commit.
  if [[ "$(git symbolic-ref --quiet --short HEAD || true)" != main ]]; then
    if git show-ref --verify --quiet refs/heads/main; then
      git switch main
    else
      git switch -c main
    fi
  fi
  git merge --ff-only "$RESOLVED"
  if [[ "$(git config --get-all remote.origin.fetch || true)" == '+refs/heads/production:refs/remotes/origin/production' ]]; then
    git config remote.origin.fetch '+refs/heads/main:refs/remotes/origin/main'
  fi
  git config branch.main.remote origin
  git config branch.main.merge refs/heads/main
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then echo "Another appliance mutation is already running." >&2; exit 30; fi
if [[ "${1:-}" == --published ]]; then
  [[ $EUID -eq 0 && "${2:-}" =~ ^[0-9a-f]{40}$ && ( -z "${3:-}" || "${3:-}" == --full ) ]] || exit 2
  [[ ! -e "$REQUEST_FILE" ]] || { echo "An update journal is pending; recover it before starting another update." >&2; exit 30; }
  cd "$HUB_ROOT"
  [[ "$(git rev-parse refs/remotes/origin/main)" == "$2" ]] || exit 34
  REQUEST_FILE="$REQUEST_FILE" python3 - "$2" "${3:-}" <<'PYREQUEST'
import json,os,sys
p=os.environ['REQUEST_FILE']
with open(p+'.tmp','w') as f: json.dump({'action':'published','targetCommit':sys.argv[1], 'forceFull':sys.argv[2]=='--full'},f)
os.chmod(p+'.tmp',0o600);os.replace(p+'.tmp',p)
PYREQUEST
fi
[[ -s "$REQUEST_FILE" ]] || { write_state failed "Application update request is missing." false; exit 31; }
eval "$(REQUEST_FILE="$REQUEST_FILE" python3 - <<'PY'
import json,os,shlex
j=json.load(open(os.environ['REQUEST_FILE']))
for key in ('action','targetRef','targetCommit','expectedVersion','rollbackCommit','rollbackVersion','rollbackHubImage','rollbackMaintenanceImage','rollbackImageTag','backupName','backupSha256','failureBackupName','failureBackupSha256','previousHubImage','previousMaintenanceImage','previousImageTag','githubToken','forceFull','mutationStarted','planJson'):
    print(key.upper()+'='+shlex.quote(str(j.get(key) or '')))
PY
)"
ASKPASS_FILE="" TOKEN_FILE=""
cleanup_credentials(){ [[ -z "$ASKPASS_FILE" ]] || rm -f "$ASKPASS_FILE"; [[ -z "$TOKEN_FILE" ]] || rm -f "$TOKEN_FILE"; }
cleanup_exit(){
  cleanup_credentials
  rm -f "$ROOMGOBLIN_RUNNER_SNAPSHOT"
  if [[ "${MUTATIONSTARTED:-}" != true && "${DEPLOYMENT_MUTATED:-false}" != true ]]; then rm -f "$REQUEST_FILE"; fi
}
trap cleanup_exit EXIT
if [[ -n "$GITHUBTOKEN" ]]; then
  ASKPASS_FILE="$(mktemp /run/classroom-hub-git-askpass.XXXXXX)"; TOKEN_FILE="$(mktemp /run/classroom-hub-git-token.XXXXXX)"
  chmod 0700 "$ASKPASS_FILE"; chmod 0600 "$TOKEN_FILE"; printf '%s' "$GITHUBTOKEN" >"$TOKEN_FILE"
  printf '#!/bin/sh\ncase "$1" in *Username*) printf "%%s\\n" x-access-token;; *) cat %q;; esac\n' "$TOKEN_FILE" >"$ASKPASS_FILE"
  export GIT_ASKPASS="$ASKPASS_FILE" GIT_TERMINAL_PROMPT=0
fi

cd "$HUB_ROOT"
CURRENT_COMMIT="${ROLLBACKCOMMIT:-$(git rev-parse HEAD)}"
CURRENT_VERSION="${ROLLBACKVERSION:-$(tr -d '\r\n' < VERSION 2>/dev/null || true)}"
CURRENT_IMAGE_TAG="${ROLLBACKIMAGETAG:-$(sed -n 's/^CLASSROOM_CONTROL_HUB_TAG=//p' .env | tail -n 1)}"
CURRENT_IMAGE_TAG="${CURRENT_IMAGE_TAG:-alpha}"
[[ "$CURRENT_IMAGE_TAG" =~ ^[A-Za-z0-9._-]{1,180}$ ]] || CURRENT_IMAGE_TAG="recovery-${CURRENT_COMMIT:0:12}"
if [[ "$ROLLBACKHUBIMAGE" =~ ^sha256:[0-9a-f]{64}$ && "$ROLLBACKMAINTENANCEIMAGE" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  CURRENT_HUB_IMAGE="$ROLLBACKHUBIMAGE"
  CURRENT_MAINTENANCE_IMAGE="$ROLLBACKMAINTENANCEIMAGE"
else
  CURRENT_HUB_IMAGE="$(capture_recovery_image classroom-control-hub "hub-${CURRENT_COMMIT:0:12}")"
  CURRENT_MAINTENANCE_IMAGE="$(capture_recovery_image classroom-control-hub-maintenance "maintenance-${CURRENT_COMMIT:0:12}")"
  set_request_fields "rollbackHubImage=$CURRENT_HUB_IMAGE" "rollbackMaintenanceImage=$CURRENT_MAINTENANCE_IMAGE" "rollbackImageTag=$CURRENT_IMAGE_TAG"
fi

rollback(){
  local rc=$?
  [[ "$rc" != 0 ]] || rc=1
  trap - ERR
  write_state rollback "Update failed; restoring the previous source and matching safety backup." null
  local rollback_ok=true
  git checkout --detach "$CURRENT_COMMIT" || rollback_ok=false
  if [[ -f "$STATE_DIR/app-update.env" ]]; then cp "$STATE_DIR/app-update.env" .env || rollback_ok=false; chmod 0600 .env; fi
  ensure_runtime_layout || rollback_ok=false
  if [[ -f "$STATE_DIR/app-update-host.service" ]]; then
    install -m 0644 "$STATE_DIR/app-update-host.service" /etc/systemd/system/classroom-hub-host-agent.service || rollback_ok=false
    systemctl daemon-reload || rollback_ok=false
    systemctl restart classroom-hub-host-agent.service || rollback_ok=false
  else
    refresh_host_agent || rollback_ok=false
  fi
  set_image_tag "$CURRENT_IMAGE_TAG" || rollback_ok=false
  activate_recovery_pair "$CURRENT_HUB_IMAGE" "$CURRENT_MAINTENANCE_IMAGE" || rollback_ok=false
  # Never restore database/data if stopping the writer failed. Start only the
  # previous maintenance implementation while the Hub remains stopped.
  if [[ "$rollback_ok" == true ]] &&
      docker compose stop classroom-hub &&
      docker compose up --no-start --no-deps --force-recreate classroom-hub &&
      docker compose up -d --no-build --no-deps --force-recreate maintenance-agent &&
      wait_maintenance &&
      restore_safety_backup "$FAILUREBACKUPNAME" "$FAILUREBACKUPSHA256"; then
    docker compose up -d --no-build --force-recreate --remove-orphans maintenance-agent classroom-hub || rollback_ok=false
  else
    rollback_ok=false
  fi
  appliance_health_check "$CURRENT_VERSION" || rollback_ok=false
  [[ "$(docker inspect --format '{{.Image}}' classroom-control-hub)" == "$CURRENT_HUB_IMAGE" ]] || rollback_ok=false
  [[ "$(docker inspect --format '{{.Image}}' classroom-control-hub-maintenance)" == "$CURRENT_MAINTENANCE_IMAGE" ]] || rollback_ok=false
  if [[ "$rollback_ok" == true ]]; then
    set_state_fields "rollback=true" "activeCommit=$CURRENT_COMMIT" "activeVersion=$CURRENT_VERSION"
    write_state rolled-back "Update failed and the previous version was restored successfully." false
  else
    set_state_fields "rollback=failed"
    write_state rollback-failed "Update failed and automatic rollback needs administrator attention." false
  fi
  rm -f "$STATE_DIR/deployment.json"
  [[ "$rollback_ok" != true ]] || rm -f "$REQUEST_FILE" "$STATE_DIR/app-update.env" "$STATE_DIR/app-update-host.service"
  exit "$rc"
}
preflight_failure(){
  local rc=$?
  write_state failed "Update preflight failed; running services were not changed." false
  rm -f "$REQUEST_FILE" "$STATE_DIR/app-update.env" "$STATE_DIR/app-update-host.service"
  exit "$rc"
}
trap preflight_failure ERR
# Never replay an interrupted deployment against partially migrated state.
if [[ "$MUTATIONSTARTED" == true ]]; then rollback; fi

write_state preflight "Checking the Git checkout and resolving the trusted update target." null
TRACKED_CHANGES="$(git status --porcelain --untracked-files=no)"
if [[ -n "$TRACKED_CHANGES" ]]; then
  if [[ -z "$(printf '%s\n' "$TRACKED_CHANGES" | awk '{print $2}' | grep -Ev '^config/(devices|hardware)\.json$')" ]]; then
    legacy_dir="$HUB_ROOT/data/legacy-config-migration/$(date -u +%Y%m%dT%H%M%SZ)"
    install -d -m 0700 -o 10001 -g 10001 "$legacy_dir"
    for legacy in config/devices.json config/hardware.json; do [[ ! -f "$legacy" ]] || install -m 0600 -o 10001 -g 10001 "$legacy" "$legacy_dir/$(basename "$legacy")"; done
    git checkout -- config/devices.json config/hardware.json
  else
    echo "Tracked source has unsupported local changes"; git status --short --untracked-files=no; exit 32
  fi
fi
ORIGIN_URL="$(git remote get-url origin)"
case "$ORIGIN_URL" in
  https://github.com/wagnerks1990/RoomGoblin|https://github.com/wagnerks1990/RoomGoblin.git|git@github.com:wagnerks1990/RoomGoblin.git|ssh://git@github.com/wagnerks1990/RoomGoblin.git|https://github.com/wagnerks1990/classroom-control-hub|https://github.com/wagnerks1990/classroom-control-hub.git|git@github.com:wagnerks1990/classroom-control-hub.git|ssh://git@github.com/wagnerks1990/classroom-control-hub.git) ;;
  *) echo "Refusing update from unexpected origin: $ORIGIN_URL"; exit 36 ;;
esac
git fetch --tags origin +refs/heads/main:refs/remotes/origin/main
if [[ "$ACTION" == published ]]; then
  [[ "$TARGETCOMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 33
  git merge-base --is-ancestor "$TARGETCOMMIT" refs/remotes/origin/main
  git merge-base --is-ancestor HEAD "$TARGETCOMMIT"
  source_branch="$(git symbolic-ref --quiet --short HEAD || true)"
  [[ -z "$source_branch" || "$source_branch" == main || "$source_branch" == production ]] || { echo "Only main or a legacy/recovery checkout can be updated" >&2; false; }
  if git show-ref --verify --quiet refs/heads/main; then
    git merge-base --is-ancestor refs/heads/main "$TARGETCOMMIT" || { echo "Local main diverges; refusing to overwrite its commits" >&2; false; }
  fi
  RESOLVED="$TARGETCOMMIT"
elif [[ "$ACTION" == revert ]]; then
  [[ "$TARGETCOMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid rollback commit"; exit 33; }
  RESOLVED="$TARGETCOMMIT"
else
  [[ "$TARGETREF" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || { echo "Only semantic-version release tags are accepted"; exit 34; }
  RESOLVED="$(git rev-parse --verify "refs/tags/$TARGETREF^{commit}")"
fi
git merge-base --is-ancestor "$RESOLVED" origin/main || { echo "Selected release is not in the trusted origin/main history"; exit 37; }
set_state_fields "targetCommit=$RESOLVED"

ACTUAL_VERSION="$(git show "$RESOLVED:VERSION" | tr -d '\r\n')"
[[ -z "$EXPECTEDVERSION" || "$ACTUAL_VERSION" == "$EXPECTEDVERSION" ]] || { echo "Release VERSION does not match GitHub metadata"; false; }
PLAN_FULL=true PLAN_HUB=true PLAN_MAINTENANCE=true PLAN_HOST=true
if [[ "$ACTION" == published ]]; then
  force_args=(); [[ "$FORCEFULL" != True ]] || force_args+=(--full)
  PLANJSON="$(python3 deploy/update-plan.py "$RESOLVED" "${force_args[@]}")"
  eval "$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); [print("PLAN_"+k.upper()+"="+str(p[k]).lower()) for k in ("full","hub","maintenance","host")]' "$PLANJSON")"
  echo "Update plan: $PLANJSON"
fi
if [[ "$ACTION" != revert ]]; then
  IMAGE_TAG="$TARGETREF"
  [[ "$ACTION" != published ]] || IMAGE_TAG="sha-$RESOLVED"
  HUB_IMAGE="ghcr.io/wagnerks1990/roomgoblin:${IMAGE_TAG}"
  MAINTENANCE_IMAGE="ghcr.io/wagnerks1990/roomgoblin-maintenance:${IMAGE_TAG}"
  roomgoblin_wait_image_pair "$RESOLVED" "$HUB_IMAGE" "$MAINTENANCE_IMAGE" probe
  if [[ "$PLAN_HUB" == true ]]; then
    timeout 900 docker pull "$HUB_IMAGE"
    roomgoblin_verify_image_revision "$HUB_IMAGE" "$RESOLVED"
  fi
  if [[ "$PLAN_MAINTENANCE" == true ]]; then
    timeout 900 docker pull "$MAINTENANCE_IMAGE"
    roomgoblin_verify_image_revision "$MAINTENANCE_IMAGE" "$RESOLVED"
  fi
fi
if [[ "$ACTION" == published ]]; then
  appliance_health_check "$CURRENT_VERSION"
  if [[ "$PLAN_HUB" == false && "$PLAN_MAINTENANCE" == false && "$PLAN_HOST" == false ]]; then
    advance_main_source
    set_state_fields "activeCommit=$RESOLVED" "activeVersion=$ACTUAL_VERSION"
    python3 deploy/update-plan.py "$RESOLVED" --record
    rm -f "$REQUEST_FILE"
    write_state completed "Main source synchronized; runtime inputs are unchanged. No services restarted." true
    echo "Source synchronized. No downloads or service restarts were needed."
    exit 0
  fi
  # The legacy operational restore format has one canonical DB destination.
  # Refuse a selective transaction against a different configured identity.
  docker compose exec -T classroom-hub node -e 'if((process.env.DATABASE_FILE||"/app/data/classroom-control-hub.db")!=="/app/data/classroom-control-hub.db")process.exit(1)' || { echo "Custom database identity requires the full installer and its per-database snapshots." >&2; false; }
  write_state backup "Creating the operational safety backup before changing services." null
  BACKUP_JSON="$(docker compose exec -T maintenance-agent node -e '
    fetch("http://127.0.0.1:"+(process.env.PORT||3010)+"/backup/create",{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":process.env.MAINTENANCE_TOKEN},body:JSON.stringify({scope:"operational",confirmSensitiveData:true}),signal:AbortSignal.timeout(180000)}).then(async r=>{const j=await r.json();if(!r.ok||!j.ok)throw Error("Operational backup failed"); const r2=await fetch("http://127.0.0.1:"+(process.env.PORT||3010)+"/backup/"+encodeURIComponent(j.name)+"/inspect",{headers:{"x-maintenance-token":process.env.MAINTENANCE_TOKEN}});const checked=await r2.json();if(!r2.ok||checked.manifest?.databaseSnapshot!==true)throw Error("Missing database snapshot");console.log(JSON.stringify({name:j.name,sha256:j.sha256}))}).catch(()=>process.exit(1))'
  )"
  read -r BACKUPNAME BACKUPSHA256 < <(python3 -c 'import json,re,sys; j=json.loads(sys.argv[1]); assert re.fullmatch(r"[A-Za-z0-9._-]+\.zip",j["name"]); assert re.fullmatch("[0-9a-f]{64}",j["sha256"]); print(j["name"],j["sha256"])' "$BACKUP_JSON")
  [[ -n "$BACKUPNAME" && -n "$BACKUPSHA256" ]]
  FAILUREBACKUPNAME="$BACKUPNAME" FAILUREBACKUPSHA256="$BACKUPSHA256"
  set_request_fields "backupName=$BACKUPNAME" "backupSha256=$BACKUPSHA256" "failureBackupName=$BACKUPNAME" "failureBackupSha256=$BACKUPSHA256" "rollbackCommit=$CURRENT_COMMIT" "rollbackVersion=$CURRENT_VERSION"
  set_state_fields "plan=$PLANJSON"
fi
if [[ "$ACTION" == update || "$ACTION" == published ]]; then
  set_state_fields "action=$ACTION" "previousCommit=$CURRENT_COMMIT" "previousVersion=$CURRENT_VERSION" "previousHubImage=$CURRENT_HUB_IMAGE" "previousMaintenanceImage=$CURRENT_MAINTENANCE_IMAGE" "previousImageTag=$CURRENT_IMAGE_TAG" "targetRef=$TARGETREF" "backupName=$BACKUPNAME" "backupSha256=$BACKUPSHA256"
else
  set_state_fields "action=$ACTION" "targetRef=$TARGETREF"
fi

if [[ -f /etc/systemd/system/classroom-hub-host-agent.service ]]; then
  cp /etc/systemd/system/classroom-hub-host-agent.service "$STATE_DIR/app-update-host.service"
  chmod 0600 "$STATE_DIR/app-update-host.service"
  sync -f "$STATE_DIR/app-update-host.service"
fi
cp .env "$STATE_DIR/app-update.env"
chmod 0600 "$STATE_DIR/app-update.env"
sync -f "$STATE_DIR/app-update.env"
# Journal precedes every source/runtime mutation and survives process/host restart.
set_request_fields mutationStarted=true
DEPLOYMENT_MUTATED=true
trap rollback ERR
write_state switching "Switching the appliance source to the selected build." null
if [[ "$ACTION" == published ]]; then advance_main_source; else git checkout --detach "$RESOLVED"; fi
if [[ "$ACTION" != published || "$PLAN_FULL" != true ]]; then
  if [[ "$PLAN_FULL" == true ]]; then ensure_runtime_layout; fi
  if [[ "$PLAN_HOST" == true ]]; then refresh_host_agent; fi
fi

if [[ "$ACTION" == revert && -n "$PREVIOUSHUBIMAGE" && -n "$PREVIOUSMAINTENANCEIMAGE" ]]; then
  write_state building "Activating the immutable images saved for $ACTUAL_VERSION." null
  set_image_tag "$PREVIOUSIMAGETAG"
  activate_recovery_pair "$PREVIOUSHUBIMAGE" "$PREVIOUSMAINTENANCEIMAGE"
else
  if [[ "$PLAN_HUB" == true ]]; then set_component_tag ROOMGOBLIN_HUB_TAG "$IMAGE_TAG"; fi
  if [[ "$PLAN_MAINTENANCE" == true ]]; then set_component_tag ROOMGOBLIN_MAINTENANCE_TAG "$IMAGE_TAG"; fi
fi
if [[ "$ACTION" == revert ]]; then
  write_state restoring "Restoring the matching pre-upgrade state before the older application starts." null
  docker compose stop classroom-hub
  docker compose up --no-start --no-deps --force-recreate classroom-hub
  docker compose up -d --no-build --no-deps --force-recreate maintenance-agent
  wait_maintenance
  restore_safety_backup "$BACKUPNAME" "$BACKUPSHA256"
fi
if [[ "$ACTION" == published && "$PLAN_FULL" == true ]]; then
  write_state deploying "Deployment layout or migration changed; running full reconciliation." null
  bash "$HUB_ROOT/install.sh"
else
  write_state deploying "Recreating changed components while preserving unchanged services." null
  if [[ "$PLAN_MAINTENANCE" == true ]]; then docker compose up -d --no-build --no-deps --force-recreate maintenance-agent; fi
  if [[ "$PLAN_HUB" == true ]]; then docker compose up -d --no-build --no-deps --force-recreate classroom-hub; fi
fi
write_state verifying "Waiting for backend HTTP, maintenance, Host Agent, ADB key storage, Android inventory access, and version convergence." null
verified=false
for _ in $(seq 1 30); do
  if HEALTH_ATTEMPTS=1 appliance_health_check "$ACTUAL_VERSION"; then verified=true; break; fi
  sleep 2
done
[[ "$verified" == true ]]
if [[ "$ACTION" == published ]]; then
  expected_hub="$CURRENT_HUB_IMAGE" expected_maintenance="$CURRENT_MAINTENANCE_IMAGE"
  [[ "$PLAN_HUB" != true ]] || expected_hub="$(docker image inspect --format '{{.Id}}' "$HUB_IMAGE")"
  [[ "$PLAN_MAINTENANCE" != true ]] || expected_maintenance="$(docker image inspect --format '{{.Id}}' "$MAINTENANCE_IMAGE")"
  [[ "$(docker inspect --format '{{.Image}}' classroom-control-hub)" == "$expected_hub" ]]
  [[ "$(docker inspect --format '{{.Image}}' classroom-control-hub-maintenance)" == "$expected_maintenance" ]]
fi
if [[ -f deploy/update-plan.py ]]; then python3 deploy/update-plan.py "$RESOLVED" --record; else rm -f "$STATE_DIR/deployment.json"; fi
trap - ERR
if [[ "$ACTION" == revert ]]; then
  set_state_fields "activeCommit=$RESOLVED" "activeVersion=$ACTUAL_VERSION" "rollback=false" "revertAvailable=false" "previousCommit=" "previousVersion=" "previousHubImage=" "previousMaintenanceImage=" "previousImageTag=" "backupName=" "backupSha256="
else
  set_state_fields "activeCommit=$RESOLVED" "activeVersion=$ACTUAL_VERSION" "rollback=false" "revertAvailable=true"
fi
# Keep automatic pre-* recovery archives bounded after a verified update.
# The maintenance endpoint preserves the currently pinned revert backup and
# never deletes user-created or Full Recovery archives. Cleanup is best-effort
# because application health has already been verified at this point.
docker compose exec -T maintenance-agent node -e '
fetch("http://127.0.0.1:"+(process.env.PORT||3010)+"/backups/retention",{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":process.env.MAINTENANCE_TOKEN},body:JSON.stringify({keep:10,confirm:"PRUNE_AUTOMATIC_BACKUPS"}),signal:AbortSignal.timeout(30000)}).then(async r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(j=>console.log("Automatic backup retention:",JSON.stringify(j))).catch(e=>{console.error("Automatic backup retention warning:",e.message);process.exit(1)})
' || echo "Warning: automatic backup retention cleanup did not complete; update remains healthy." >&2

install -D -m 0755 "$HUB_ROOT/host-agent/update-runner.sh" /usr/local/libexec/classroom-control-hub/update-runner.sh
install -D -m 0755 "$HUB_ROOT/host-agent/app-update-runner.sh" /usr/local/libexec/classroom-control-hub/app-update-runner.sh
rm -f "$REQUEST_FILE" "$STATE_DIR/app-update.env" "$STATE_DIR/app-update-host.service"
write_state completed "RoomGoblin $ACTUAL_VERSION deployed and verified successfully over HTTP." true
