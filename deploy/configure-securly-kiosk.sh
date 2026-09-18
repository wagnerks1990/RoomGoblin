#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${SECURLY_KIOSK_CONFIG:-/etc/roomgoblin/securly-kiosk.env}"
KIOSK_USER="${SECURLY_KIOSK_USER:-kiosk}"
ADMIN_USER="${SECURLY_KIOSK_ADMIN_USER:-}"
URL_FILE="/etc/roomgoblin/securly-kiosk-url"

log(){ printf '%s\n' "$*"; }
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require_root(){ [[ ${EUID:-$(id -u)} -eq 0 ]] || fail 'run as root'; }

load_config(){
  [[ -f "$CONFIG_FILE" ]] || fail "missing $CONFIG_FILE; create it from docs/SECURLY-KIOSK.md"
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  : "${SECURLY_KIOSK_URL:?SECURLY_KIOSK_URL is required in $CONFIG_FILE}"
  ADMIN_USER="${SECURLY_KIOSK_ADMIN_USER:-$ADMIN_USER}"
}

ensure_packages(){
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    xorg xinit openbox unclutter x11-xserver-utils dbus-x11 openssh-server chromium-browser
  if ! command -v chromium >/dev/null 2>&1 && ! command -v /snap/bin/chromium >/dev/null 2>&1; then
    command -v snap >/dev/null 2>&1 || fail 'Chromium is unavailable and snap is not installed'
    snap install chromium
  fi
}

ensure_user(){
  if ! id "$KIOSK_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos '' "$KIOSK_USER"
  fi
  passwd -l "$KIOSK_USER" >/dev/null 2>&1 || true
  gpasswd -d "$KIOSK_USER" sudo >/dev/null 2>&1 || true
  for group in audio video render; do
    getent group "$group" >/dev/null 2>&1 && usermod -aG "$group" "$KIOSK_USER"
  done
}

ensure_admin(){
  [[ -n "$ADMIN_USER" ]] || return 0
  id "$ADMIN_USER" >/dev/null 2>&1 || fail "configured admin user does not exist: $ADMIN_USER"
  id -nG "$ADMIN_USER" | tr ' ' '\n' | grep -qx sudo || fail "$ADMIN_USER is not in sudo"
}

write_secret_url(){
  install -d -m 0750 -o root -g "$KIOSK_USER" /etc/roomgoblin
  printf '%s\n' "$SECURLY_KIOSK_URL" > "$URL_FILE"
  chown root:"$KIOSK_USER" "$URL_FILE"
  chmod 0640 "$URL_FILE"
}

configure_nvidia_xorg(){
  command -v nvidia-smi >/dev/null 2>&1 || return 0
  local drv
  drv="$(find /usr/lib /lib -name nvidia_drv.so -print -quit 2>/dev/null || true)"
  [[ -n "$drv" ]] || fail 'NVIDIA kernel driver detected but nvidia_drv.so is missing; install the matching Ubuntu xserver-xorg-video-nvidia package before continuing'
  local slot bus dev fn
  slot="$(lspci -Dn 2>/dev/null | awk '$2 ~ /^030[02]:/ && $3 ~ /^10de:/ {print $1; exit}')"
  [[ -n "$slot" ]] || return 0
  slot="${slot#0000:}"
  IFS=':.' read -r bus dev fn <<<"$slot"
  mkdir -p /etc/X11/xorg.conf.d
  cat >/etc/X11/xorg.conf.d/20-nvidia-kiosk.conf <<EOF_NVIDIA
Section "Device"
    Identifier     "RoomGoblin NVIDIA Kiosk"
    Driver         "nvidia"
    BusID          "PCI:$((16#$bus)):$((16#$dev)):$((16#$fn))"
    Option         "AllowEmptyInitialConfiguration" "true"
    Option         "PrimaryGPU" "yes"
EndSection

Section "Screen"
    Identifier     "Screen0"
    Device         "RoomGoblin NVIDIA Kiosk"
    DefaultDepth   24
EndSection
EOF_NVIDIA
  cat >/etc/X11/Xwrapper.config <<'EOF_XWRAP'
allowed_users=console
needs_root_rights=yes
EOF_XWRAP
}

write_kiosk_files(){
  local home
  home="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
  [[ -n "$home" ]] || fail "cannot resolve home for $KIOSK_USER"
  install -d -m 0755 -o "$KIOSK_USER" -g "$KIOSK_USER" "$home/.config/openbox"

  cat >"$home/.bash_profile" <<'EOF_PROFILE'
if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec startx -- -nolisten tcp
fi
EOF_PROFILE

  cat >"$home/.xinitrc" <<'EOF_XINIT'
#!/bin/bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
exec openbox-session
EOF_XINIT

  cat >"$home/.config/openbox/autostart" <<'EOF_AUTOSTART'
#!/bin/bash
xset s off
xset s noblank
xset -dpms
unclutter -idle 3 -root &
sleep 3

SECURLY_URL="$(cat /etc/roomgoblin/securly-kiosk-url)"
CHROMIUM_LOG="$HOME/chromium-kiosk.log"
RESTART_LOG="$HOME/chromium-restart.log"
touch "$CHROMIUM_LOG" "$RESTART_LOG"

while true; do
    /snap/bin/chromium \
        --kiosk \
        --disable-gpu \
        --no-first-run \
        --no-default-browser-check \
        --noerrdialogs \
        --disable-session-crashed-bubble \
        --disable-translate \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --password-store=basic \
        "$SECURLY_URL" \
        </dev/null \
        >>"$CHROMIUM_LOG" 2>&1
    echo "$(date -Is) Chromium exited; restarting in 3 seconds" >>"$RESTART_LOG"
    sleep 3
done &
EOF_AUTOSTART

  cat >"$home/.config/openbox/rc.xml" <<'EOF_OPENBOX'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <focus><focusNew>yes</focusNew><followMouse>no</followMouse><focusLast>yes</focusLast></focus>
  <placement><policy>Smart</policy><center>yes</center><monitor>Primary</monitor></placement>
  <desktops><number>1</number><firstdesk>1</firstdesk></desktops>
  <keyboard>
    <keybind key="A-F4"><action name="Execute"><command>/bin/true</command></action></keybind>
    <keybind key="A-space"><action name="Execute"><command>/bin/true</command></action></keybind>
    <keybind key="C-A-Left"><action name="Execute"><command>/bin/true</command></action></keybind>
    <keybind key="C-A-Right"><action name="Execute"><command>/bin/true</command></action></keybind>
  </keyboard>
  <mouse>
    <context name="Root"><mousebind button="Right" action="Press"><action name="Execute"><command>/bin/true</command></action></mousebind></context>
  </mouse>
  <applications><application class="Chromium*"><decor>no</decor><maximized>yes</maximized><focus>yes</focus></application></applications>
</openbox_config>
EOF_OPENBOX

  touch "$home/chromium-kiosk.log" "$home/chromium-restart.log"
  chown "$KIOSK_USER:$KIOSK_USER" "$home/.bash_profile" "$home/.xinitrc" "$home/.config/openbox/autostart" "$home/.config/openbox/rc.xml" "$home/chromium-kiosk.log" "$home/chromium-restart.log"
  chmod 0644 "$home/.bash_profile" "$home/.config/openbox/rc.xml"
  chmod 0750 "$home/.xinitrc" "$home/.config/openbox/autostart"
}

configure_getty(){
  mkdir -p /etc/systemd/system/getty@tty1.service.d
  cat >/etc/systemd/system/getty@tty1.service.d/override.conf <<EOF_GETTY
[Service]
ExecStart=
ExecStart=-/usr/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
Type=idle
EOF_GETTY
  systemctl daemon-reload
  systemctl set-default graphical.target
  systemctl enable ssh
}

write_management_commands(){
  cat >/usr/local/sbin/kiosk-status <<'EOF_STATUS'
#!/bin/bash
echo '=== SECURLY KIOSK STATUS ==='
systemctl status getty@tty1.service --no-pager -l || true
echo '--- Xorg ---'; pgrep -a Xorg || true
echo '--- Openbox ---'; pgrep -a openbox || true
echo '--- Chromium ---'; pgrep -af '/snap/chromium/.*/chrome.*--kiosk' || true
echo '--- Display ---'
if pgrep -x Xorg >/dev/null; then sudo -u kiosk env DISPLAY=:0 XAUTHORITY=/home/kiosk/.Xauthority xrandr --current 2>/dev/null | head -20 || true; fi
echo '--- Securly window ---'
if pgrep -f '/snap/chromium/.*/chrome.*--kiosk' >/dev/null; then sudo -u kiosk env DISPLAY=:0 XAUTHORITY=/home/kiosk/.Xauthority xwininfo -root -tree 2>/dev/null | grep -E 'Securly|Chromium' || true; fi
echo '--- Chromium restarts ---'; tail -20 /home/kiosk/chromium-restart.log 2>/dev/null || true
echo '--- NVIDIA ---'; nvidia-smi --query-gpu=name,driver_version,temperature.gpu,memory.used --format=csv,noheader 2>/dev/null || true
echo '--- SSH ---'; systemctl is-enabled ssh 2>/dev/null || true; systemctl is-active ssh 2>/dev/null || true
echo '--- Failed services ---'; systemctl --failed --no-pager
EOF_STATUS

  cat >/usr/local/sbin/kiosk-restart <<'EOF_RESTART'
#!/bin/bash
systemctl reset-failed getty@tty1.service || true
systemctl restart getty@tty1.service
sleep 8
/usr/local/sbin/kiosk-status
EOF_RESTART

  cat >/usr/local/sbin/kiosk-stop <<'EOF_STOP'
#!/bin/bash
systemctl stop getty@tty1.service
pkill -u kiosk chromium 2>/dev/null || true
pkill -u kiosk openbox 2>/dev/null || true
EOF_STOP

  cat >/usr/local/sbin/kiosk-start <<'EOF_START'
#!/bin/bash
systemctl reset-failed getty@tty1.service || true
systemctl start getty@tty1.service
sleep 8
/usr/local/sbin/kiosk-status
EOF_START

  cat >/usr/local/sbin/kiosk-logs <<'EOF_LOGS'
#!/bin/bash
tail -100 /home/kiosk/chromium-kiosk.log 2>/dev/null || true
tail -100 /home/kiosk/chromium-restart.log 2>/dev/null || true
journalctl -u getty@tty1.service -n 100 --no-pager
EOF_LOGS

  chmod 0755 /usr/local/sbin/kiosk-{status,restart,stop,start,logs}
}

install_kiosk(){
  require_root
  load_config
  ensure_packages
  ensure_user
  ensure_admin
  write_secret_url
  configure_nvidia_xorg
  write_kiosk_files
  configure_getty
  write_management_commands
  systemctl reset-failed getty@tty1.service || true
  systemctl restart getty@tty1.service
  sleep 10
  /usr/local/sbin/kiosk-status || true
}

case "${1:-install}" in
  install) install_kiosk ;;
  status) require_root; /usr/local/sbin/kiosk-status ;;
  start|stop|restart|logs) require_root; "/usr/local/sbin/kiosk-$1" ;;
  *) fail "usage: $0 [install|status|start|stop|restart|logs]" ;;
esac
