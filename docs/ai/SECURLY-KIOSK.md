# AI Context: Securly Host Kiosk

This page is the machine/assistant contract for the optional Securly Pass kiosk running on the RoomGoblin appliance's physical console.

## Boundaries

- The kiosk is a **host-side optional service**, not a RoomGoblin container and not RoomGoblin application state.
- Never commit or print the production Securly kiosk URL/code. Public examples use `REPLACE_WITH_LOCAL_KIOSK_CODE`.
- Persist the URL only in local protected files under `/etc/roomgoblin/`.
- Preserve a separate sudo-capable maintenance account and SSH.
- Keep `Ctrl+Alt+F2` available for physical recovery; do not globally disable VT switching.
- The `kiosk` account must remain password-locked and must not have sudo access.

## Known-good session model

```text
tty1 autologin
 -> kiosk
 -> startx
 -> Xorg :0
 -> Openbox
 -> Chromium Snap --kiosk
```

Critical invariants:

1. `.xinitrc` uses the systemd user bus:
   - `XDG_RUNTIME_DIR=/run/user/<uid>`
   - `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/<uid>/bus`
2. Do not use a private `dbus-launch` session for Chromium Snap.
3. Chromium stdin is `/dev/null`; stdout/stderr go to files so Snap does not inherit `/dev/tty1`.
4. Do not configure an arbitrary custom `--user-data-dir`; use Snap's default profile location.
5. Keep `--disable-gpu` unless a later physical validation proves the Snap/NVIDIA rendering path is stable without it.
6. Xorg may still use the proprietary NVIDIA driver. Do not confuse Chromium software rendering with removal of the Xorg GPU driver.
7. When NVIDIA is present, require a matching Xorg module (`nvidia_drv.so`). Never mix driver packaging families merely to make X start.

## Operations

Repository helper: `deploy/configure-securly-kiosk.sh`.

Installed host helpers:

```text
kiosk-status
kiosk-start
kiosk-stop
kiosk-restart
kiosk-logs
```

Run kiosk mutations from SSH or another TTY. Stopping `getty@tty1` from tty1 terminates the current shell.

## Acceptance evidence

The 2026-09-18 physical acceptance on Ubuntu Server 26.04.1 LTS verified:

- tty1 kiosk autologin after cold boot;
- Xorg/Openbox/Chromium automatic startup;
- 1920x1080 HDMI output;
- Securly kiosk window rendered full-screen;
- the persistent query-code login URL was accepted and navigated to the kiosk launch route;
- zero Chromium watchdog restarts after the final cold boot;
- NVIDIA 610.57.04 kernel/Xorg stack healthy;
- SSH enabled and active;
- no failed systemd services.

This evidence applies to that host/time, not every future Ubuntu/Chromium/NVIDIA combination.

## Non-regression rule

Changes to RoomGoblin application containers, scheduler recovery, Morning Announcements, Background Music, managed displays, Veyon or Docker integrations must remain independent of kiosk availability. A kiosk failure must not become a RoomGoblin health dependency.
