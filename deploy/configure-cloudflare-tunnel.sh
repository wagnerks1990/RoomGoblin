#!/usr/bin/env bash
set -euo pipefail

TARGET="${ROOMGOBLIN_ROOT:-/opt/classroom-hub}"
TOKEN_PATH="/etc/cloudflared/roomgoblin.token"
UNIT_PATH="/etc/systemd/system/cloudflared-roomgoblin.service"
HUB_PORT=""
TOKEN_SOURCE=""
SKIP_INSTALL=0
NO_RESTART=0

usage() {
  cat <<'USAGE'
Configure a remotely-managed Cloudflare Tunnel connector for RoomGoblin.

Usage:
  sudo bash deploy/configure-cloudflare-tunnel.sh [options]

Options:
  --root PATH          RoomGoblin checkout (default: /opt/classroom-hub)
  --token-file PATH    Read the Cloudflare tunnel token from PATH
  --skip-install       Require an existing cloudflared binary; do not add/install packages
  --no-restart         Do not recreate the RoomGoblin Hub after updating TRUST_PROXY_HOPS
  -h, --help           Show this help

The token is stored only at /etc/cloudflared/roomgoblin.token with mode 0600.
The script never stores the token in RoomGoblin .env, Git, or command-line arguments.
USAGE
}

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

while (($#)); do
  case "$1" in
    --root) [[ $# -ge 2 ]] || fail "--root requires a value"; TARGET="$2"; shift 2 ;;
    --token-file) [[ $# -ge 2 ]] || fail "--token-file requires a value"; TOKEN_SOURCE="$2"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --no-restart) NO_RESTART=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ ${EUID:-$(id -u)} -eq 0 ]] || fail "Run as root (sudo)."
[[ -d "$TARGET" ]] || fail "RoomGoblin checkout not found: $TARGET"
[[ -f "$TARGET/.env" ]] || fail "RoomGoblin .env not found: $TARGET/.env"
[[ -f "$TARGET/docker-compose.yml" ]] || fail "docker-compose.yml not found under $TARGET"
command -v curl >/dev/null || fail "curl is required"
command -v systemctl >/dev/null || fail "systemd is required"

read_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$TARGET/.env" | tail -n 1
}

set_env_value() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done=0 }
    $0 ~ "^" key "=" { if (!done) { print key "=" value; done=1 } next }
    { print }
    END { if (!done) print key "=" value }
  ' "$TARGET/.env" > "$tmp"
  chown --reference="$TARGET/.env" "$tmp" 2>/dev/null || true
  chmod --reference="$TARGET/.env" "$tmp" 2>/dev/null || true
  mv "$tmp" "$TARGET/.env"
}

install_cloudflared() {
  if ! command -v cloudflared >/dev/null; then
    (( SKIP_INSTALL == 0 )) || fail "cloudflared is not installed and --skip-install was requested"
    command -v apt-get >/dev/null || fail "Automatic cloudflared installation currently supports Debian/Ubuntu apt hosts only"
    info "Installing cloudflared from Cloudflare's signed APT repository"
    install -d -m 0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
    chmod 0644 /usr/share/keyrings/cloudflare-main.gpg
    printf '%s\n' 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y cloudflared
  fi
  cloudflared tunnel run --help 2>&1 | grep -q -- '--token-file' || fail "cloudflared 2025.4.0 or newer is required for --token-file"
}

write_token() {
  local token=""
  install -d -m 0700 /etc/cloudflared
  if [[ -n "$TOKEN_SOURCE" ]]; then
    [[ -f "$TOKEN_SOURCE" ]] || fail "Token file not found: $TOKEN_SOURCE"
    token="$(tr -d '\r\n' < "$TOKEN_SOURCE")"
  else
    read -r -s -p "Cloudflare Tunnel token: " token
    echo
  fi
  [[ -n "$token" ]] || fail "Tunnel token is empty"
  [[ "$token" != *[[:space:]]* ]] || fail "Tunnel token contains whitespace"
  umask 077
  printf '%s\n' "$token" > "$TOKEN_PATH"
  chmod 0600 "$TOKEN_PATH"
  unset token
}

install_unit() {
  local cloudflared_bin
  cloudflared_bin="$(command -v cloudflared)"
  cat > "$UNIT_PATH" <<EOF_UNIT
[Unit]
Description=Cloudflare Tunnel for RoomGoblin
Documentation=https://developers.cloudflare.com/tunnel/
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${cloudflared_bin} tunnel --no-autoupdate run --token-file ${TOKEN_PATH}
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictSUIDSGID=true
RestrictNamespaces=true

[Install]
WantedBy=multi-user.target
EOF_UNIT
  chmod 0644 "$UNIT_PATH"
  systemctl daemon-reload
  systemctl enable --now cloudflared-roomgoblin.service
}

HUB_PORT="$(read_env_value HUB_PORT)"
HUB_PORT="${HUB_PORT:-3000}"
[[ "$HUB_PORT" =~ ^[0-9]+$ ]] || fail "HUB_PORT must be numeric"
(( HUB_PORT >= 1 && HUB_PORT <= 65535 )) || fail "HUB_PORT is out of range"

info "Checking local RoomGoblin health on 127.0.0.1:${HUB_PORT}"
curl -fsS --max-time 5 "http://127.0.0.1:${HUB_PORT}/health" >/dev/null || fail "RoomGoblin health check failed on loopback"

install_cloudflared
write_token
set_env_value TRUST_PROXY_HOPS 1
install_unit

if (( NO_RESTART == 0 )); then
  info "Recreating the RoomGoblin Hub so TRUST_PROXY_HOPS=1 takes effect"
  (
    cd "$TARGET"
    docker compose up -d --force-recreate classroom-hub
  )
fi

info "Verifying local services"
curl -fsS --max-time 10 "http://127.0.0.1:${HUB_PORT}/health" >/dev/null
systemctl is-active --quiet cloudflared-roomgoblin.service

cat <<EOF_DONE
Cloudflare Tunnel connector is running.

RoomGoblin origin for the Cloudflare public hostname:
  http://127.0.0.1:${HUB_PORT}

TRUST_PROXY_HOPS is now 1. Configure the remotely-managed tunnel's public hostname
in Cloudflare to use the origin above, then protect the application with Cloudflare
Access if remote administrative access is enabled.

Status:
  systemctl status cloudflared-roomgoblin.service --no-pager
  journalctl -u cloudflared-roomgoblin.service -n 100 --no-pager
EOF_DONE
