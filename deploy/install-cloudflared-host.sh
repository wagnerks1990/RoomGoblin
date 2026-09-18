#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "RoomGoblin cloudflared host install failed: $*" >&2; exit 1; }

[[ ${EUID:-$(id -u)} -eq 0 ]] || fail "run as root"
command -v curl >/dev/null || fail "curl is required"

# Recover only RoomGoblin's dedicated stale systemd mask before package hooks
# inspect/restart services. Never unmask or modify a generic cloudflared.service.
ROOMGOBLIN_UNIT=/etc/systemd/system/cloudflared-roomgoblin.service
if [[ -L "$ROOMGOBLIN_UNIT" ]]; then
  [[ "$(readlink "$ROOMGOBLIN_UNIT")" == /dev/null ]] || fail "RoomGoblin Cloudflare unit path is an unexpected symbolic link"
  rm -f "$ROOMGOBLIN_UNIT"
  systemctl daemon-reload
fi

if command -v cloudflared >/dev/null 2>&1; then
  cloudflared tunnel run --help 2>&1 | grep -q -- '--token-file' || fail "cloudflared 2025.4.0 or newer is required for --token-file"
  exit 0
fi

command -v apt-get >/dev/null || fail "automatic cloudflared installation currently supports Debian/Ubuntu apt hosts only"

echo "Installing cloudflared from Cloudflare's signed APT repository ..."
install -d -m 0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
chmod 0644 /usr/share/keyrings/cloudflare-main.gpg
printf '%s\n' 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y cloudflared
cloudflared tunnel run --help 2>&1 | grep -q -- '--token-file' || fail "cloudflared 2025.4.0 or newer is required for --token-file"
