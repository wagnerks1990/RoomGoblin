#!/usr/bin/env bash
set -euo pipefail
(( EUID == 0 )) || { echo "Run as root with sudo"; exit 1; }
DIR=/opt/schoology-api-test
ENV=/etc/schoology-api-test/environment
URL=https://raw.githubusercontent.com/wagnerks1990/RoomGoblin/feature/scorm-api-test-installer/experiments/schoology-api-test/server-v6.py
[[ -f "$DIR/server.py" && -f "$ENV" ]] || { echo "Existing test installation not found"; exit 1; }
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
curl -fsSL --retry 3 --connect-timeout 10 --max-time 45 "$URL" -o "$TMP"
python3 -m py_compile "$TMP"
BACKUP="$DIR/server.py.before-v6.$(date +%Y%m%d%H%M%S)"
cp -a "$DIR/server.py" "$BACKUP"
cp -a "$ENV" "$ENV.before-v6.$(date +%Y%m%d%H%M%S)"
if grep -q '^BIND_HOST=' "$ENV"; then
 sed -i 's/^BIND_HOST=.*/BIND_HOST=172.18.0.1/' "$ENV"
else
 echo 'BIND_HOST=172.18.0.1' >> "$ENV"
fi
install -m 0644 "$TMP" "$DIR/server.py"
systemctl restart schoology-api-test
for i in $(seq 1 20); do
 if curl -fsS --connect-timeout 1 --max-time 2 http://172.18.0.1:8765/api/health | grep -q '"version": 6'; then
  echo; echo "PASS: API v6 healthy"; exit 0
 fi
 sleep 1
done
echo "Upgrade health check failed; restoring previous code and config"
cp -a "$BACKUP" "$DIR/server.py"
# Preserve current CORS and credential settings; only restore BIND_HOST if needed.
systemctl restart schoology-api-test
exit 1
