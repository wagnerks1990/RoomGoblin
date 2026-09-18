#!/usr/bin/env bash
set -Eeuo pipefail
STATE_DIR=/var/lib/classroom-hub
STATE_FILE="$STATE_DIR/update-status.json"
LOCK_FILE=/run/classroom-control-hub-appliance-mutation.lock
HUB_ROOT="${CLASSROOM_HUB_DIR:-/opt/classroom-hub}"
VEYON_DROPIN_DIR=/etc/systemd/system/veyon.service.d
VEYON_DROPIN="$VEYON_DROPIN_DIR/roomgoblin-webapi.conf"
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
write_state refreshing "Refreshing Ubuntu package metadata." null
apt-get update
write_state installing "Installing available package updates. Automatic autoremove is intentionally disabled." null
apt-get -y upgrade
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
