#!/usr/bin/env bash
set -euo pipefail
if (( EUID != 0 )); then echo "Run with sudo"; exit 1; fi
apt-get update
apt-get install -y python3 curl ca-certificates
install -d -m 0755 /opt/schoology-api-test
install -d -o root -g root -m 0700 /etc/schoology-api-test
id schoology-api-test >/dev/null 2>&1 || useradd --system --home /var/lib/schoology-api-test --shell /usr/sbin/nologin schoology-api-test
install -d -o schoology-api-test -g schoology-api-test -m 0700 /var/lib/schoology-api-test
curl -fsSL https://raw.githubusercontent.com/wagnerks1990/RoomGoblin/feature/scorm-api-test-installer/experiments/schoology-api-test/server.py -o /opt/schoology-api-test/server.py
python3 -m py_compile /opt/schoology-api-test/server.py
if [[ ! -e /etc/schoology-api-test/environment ]]; then
 KEY="$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
 printf 'DEMO_KEY=%s\nALLOWED_ORIGINS=\nDATA_DIR=/var/lib/schoology-api-test\n' "$KEY" > /etc/schoology-api-test/environment
 chmod 0600 /etc/schoology-api-test/environment
fi
cat > /etc/systemd/system/schoology-api-test.service <<'EOF'
[Unit]
Description=Isolated Schoology API Test (synthetic data only)
After=network.target
[Service]
Type=simple
User=schoology-api-test
Group=schoology-api-test
WorkingDirectory=/opt/schoology-api-test
EnvironmentFile=/etc/schoology-api-test/environment
ExecStart=/usr/bin/python3 /opt/schoology-api-test/server.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/schoology-api-test
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now schoology-api-test
curl -fsS http://127.0.0.1:8765/api/health
echo "Service installed, loopback-only. HTTPS proxy and exact CORS origin required for Schoology."
