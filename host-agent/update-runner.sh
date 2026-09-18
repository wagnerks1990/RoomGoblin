#!/usr/bin/env bash
set -Eeuo pipefail
STATE_DIR=/var/lib/classroom-hub
STATE_FILE="$STATE_DIR/update-status.json"
LOCK_FILE=/run/classroom-control-hub-appliance-mutation.lock
HUB_ROOT="${CLASSROOM_HUB_DIR:-/opt/classroom-hub}"
VEYON_DROPIN_DIR=/etc/systemd/system/veyon.service.d
VEYON_DROPIN="$VEYON_DROPIN_DIR/roomgoblin-webapi.conf"
VEYON_REQUEST_FILE=/var/lib/classroom-hub/veyon-update-request.json
mkdir -p "$STATE_DIR"
write_state(){
  local phase="$1" message="$2" ok="${3:-null}"
  PHASE="$phase" MESSAGE="$message" OK="$ok" python3 - <<'PY2'
import json,os,datetime
p='/var/lib/classroom-hub/update-status.json'
ok=os.environ.get('OK','null')
obj={'phase':os.environ['PHASE'],'message':os.environ['MESSAGE'],'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ok': None if ok=='null' else ok=='true','rebootRequired':os.path.exists('/var/run/reboot-required')}
open(p,'w').write(json.dumps(obj,indent=2))
PY2
}
unit_loaded(){
  [[ "$(systemctl show "$1" --property=LoadState --value 2>/dev/null || true)" == "loaded" ]]
}
ensure_veyon_webapi_lifecycle(){
  if ! unit_loaded veyon.service || ! unit_loaded veyon-webapi.service; then return 0; fi
  install -d -m 0755 "$VEYON_DROPIN_DIR"
  cat >"$VEYON_DROPIN" <<'EOF'
[Unit]
Wants=veyon-webapi.service
EOF
  chmod 0644 "$VEYON_DROPIN"
  systemctl daemon-reload
  systemctl enable veyon.service veyon-webapi.service >/dev/null
}
verify_veyon_webapi_lifecycle(){
  if [[ "$VEYON_EXPECTED_ACTIVE" != true ]]; then return 0; fi
  systemctl start veyon.service
  systemctl is-active --quiet veyon.service
  systemctl is-active --quiet veyon-webapi.service
}
exec 9>"$LOCK_FILE"
if ! flock -n 9; then write_state failed "Another host update job is already running." false; exit 30; fi
trap 'rc=$?; if [ $rc -ne 0 ]; then write_state failed "Host update failed with exit code $rc. Review the update log and run dpkg --audit / apt-get check before retrying." false; fi' EXIT
export DEBIAN_FRONTEND=noninteractive
write_state preflight "Checking dpkg/APT health and package-manager locks." null
if [ -n "$(dpkg --audit 2>/dev/null)" ]; then echo "dpkg --audit reported problems"; dpkg --audit; exit 31; fi
apt-get check
for f in /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock /var/lib/apt/lists/lock; do
  if command -v fuser >/dev/null 2>&1 && fuser "$f" >/dev/null 2>&1; then echo "Package manager lock in use: $f"; exit 32; fi
done
VEYON_EXPECTED_ACTIVE=false
if unit_loaded veyon.service && unit_loaded veyon-webapi.service; then
  if systemctl is-active --quiet veyon.service || systemctl is-active --quiet veyon-webapi.service; then VEYON_EXPECTED_ACTIVE=true; fi
  ensure_veyon_webapi_lifecycle
fi
VEYON_RELEASE_MODE=false
VEYON_RELEASE_VERSION=""
VEYON_RELEASE_URL=""
VEYON_RELEASE_SHA256=""
VEYON_RELEASE_NAME=""
if [[ -f "$VEYON_REQUEST_FILE" ]]; then
  mapfile -t request_fields < <(python3 - "$VEYON_REQUEST_FILE" <<'PY2'
import json,re,sys
obj=json.load(open(sys.argv[1]))
fields=[str(obj.get(k) or "") for k in ("version","url","sha256","name")]
if not re.fullmatch(r"\d+\.\d+\.\d+",fields[0]): raise SystemExit(2)
if not re.fullmatch(r"[0-9a-f]{64}",fields[2]): raise SystemExit(3)
if any("\n" in x or "\r" in x for x in fields): raise SystemExit(4)
print("\n".join(fields))
PY2
  )
  [[ ${#request_fields[@]} -eq 4 ]] || { echo "Invalid Veyon update request"; exit 33; }
  VEYON_RELEASE_VERSION="${request_fields[0]}"
  VEYON_RELEASE_URL="${request_fields[1]}"
  VEYON_RELEASE_SHA256="${request_fields[2]}"
  VEYON_RELEASE_NAME="${request_fields[3]}"
  version_id="$(. /etc/os-release; printf '%s' "$VERSION_ID")"
  expected_name="veyon_${VEYON_RELEASE_VERSION}.0-ubuntu.${version_id}_amd64.deb"
  expected_url="https://github.com/veyon/veyon/releases/download/v${VEYON_RELEASE_VERSION}/${expected_name}"
  [[ "$(dpkg --print-architecture)" == amd64 && "$VEYON_RELEASE_NAME" == "$expected_name" && "$VEYON_RELEASE_URL" == "$expected_url" ]] || { echo "Veyon release request does not match this Ubuntu amd64 appliance"; exit 34; }
  rm -f -- "$VEYON_REQUEST_FILE"
  VEYON_RELEASE_MODE=true
fi
write_state refreshing "Refreshing Ubuntu package metadata." null
apt-get update
if [[ "$VEYON_RELEASE_MODE" == true ]]; then
  write_state installing "Downloading and installing verified official Veyon ${VEYON_RELEASE_VERSION} package." null
  command -v curl >/dev/null || { echo "curl is required for official Veyon release installation"; exit 35; }
  pkg="$(mktemp --suffix=.deb /tmp/roomgoblin-veyon-XXXXXX)"
  trap 'rc=$?; rm -f -- "${pkg:-}"; if [ $rc -ne 0 ]; then write_state failed "Host update failed with exit code $rc. Review the update log and run dpkg --audit / apt-get check before retrying." false; fi' EXIT
  curl --fail --location --proto '=https' --tlsv1.2 --max-filesize 67108864 --output "$pkg" "$VEYON_RELEASE_URL"
  printf '%s  %s\n' "$VEYON_RELEASE_SHA256" "$pkg" | sha256sum -c -
  [[ "$(dpkg-deb --field "$pkg" Package)" == "veyon" ]] || { echo "Downloaded package is not Veyon"; exit 36; }
  [[ "$(dpkg-deb --field "$pkg" Architecture)" == "amd64" ]] || { echo "Downloaded Veyon package architecture mismatch"; exit 37; }
  package_version="$(dpkg-deb --field "$pkg" Version)"
  [[ "$package_version" == "$VEYON_RELEASE_VERSION"* ]] || { echo "Downloaded Veyon package version mismatch: $package_version"; exit 38; }
  apt-get -y install "$pkg"
  installed_version="$(dpkg-query -W -f='${Version}' veyon)"
  [[ "$installed_version" == "$VEYON_RELEASE_VERSION"* ]] || { echo "Installed Veyon version mismatch: $installed_version"; exit 39; }
  rm -f -- "$pkg"; pkg=""
else
  write_state installing "Installing available package updates. Automatic autoremove is intentionally disabled." null
  apt-get -y upgrade
fi
write_state verifying "Verifying package database and RoomGoblin health." null
dpkg --audit
apt-get check
ensure_veyon_webapi_lifecycle
verify_veyon_webapi_lifecycle
cd "$HUB_ROOT"
docker compose exec -T classroom-hub node -e "const port=Number(process.env.PORT||3000);let host=process.env.BIND_ADDRESS||'127.0.0.1';if(host==='0.0.0.0')host='127.0.0.1';if(host==='::'||host==='[::]')host='[::1]';if(host.includes(':')&&!host.startsWith('['))host='['+host+']';fetch('http://'+host+':'+port+'/health',{signal:AbortSignal.timeout(10000)}).then(async r=>{const j=await r.json();if(!r.ok||!j.ok||(process.argv[1]&&j.version!==process.argv[1]))process.exit(1)}).catch(()=>process.exit(1))" >/dev/null
# Bound automatic pre-* safety archives after a verified host update.
# Cleanup is best-effort and preserves user-created/full-recovery archives.
docker compose exec -T maintenance-agent node -e '
fetch("http://127.0.0.1:"+(process.env.PORT||3010)+"/backups/retention",{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":process.env.MAINTENANCE_TOKEN},body:JSON.stringify({automaticKeep:3,preKeep:1,confirm:"PRUNE_AUTOMATIC_BACKUPS"}),signal:AbortSignal.timeout(30000)}).then(async r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(j=>console.log("Automatic backup retention:",JSON.stringify(j))).catch(e=>{console.error("Automatic backup retention warning:",e.message);process.exit(1)})
' || echo "Warning: automatic backup retention cleanup did not complete; host update remains healthy." >&2
write_state completed "Host update completed successfully." true
trap - EXIT
