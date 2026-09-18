# Securly Pass Kiosk

RoomGoblin can use the appliance's attached monitor, keyboard and mouse as a dedicated Securly Pass kiosk while preserving SSH and a separate sudo-capable maintenance account.

This is an **optional host configuration**, not part of the RoomGoblin containers. It was live-validated on 2026-09-18 on Ubuntu Server 26.04.1 LTS with Xorg, Openbox, Chromium Snap and an NVIDIA RTX 3060.

## Security boundary

Do not commit the real Securly kiosk URL or code. The query parameter is a persistent kiosk credential in this deployment.

Store the complete URL only on the appliance in:

```text
/etc/roomgoblin/securly-kiosk-url
```

The installer keeps it `root:kiosk 0640`. Public examples must use a placeholder:

```text
https://pass.securly.com/kiosk/login?code=REPLACE_WITH_LOCAL_KIOSK_CODE
```

The kiosk user has no usable password and no sudo membership. Administrative recovery uses a separate sudo-capable account or SSH. Do not disable Linux virtual-terminal switching; `Ctrl+Alt+F2` is an intentional recovery path.

## Validated architecture

```text
Ubuntu Server
├── tty1 autologin: kiosk
│   └── startx
│       └── Xorg :0
│           └── Openbox
│               └── Chromium --kiosk
│                   └── Securly Pass
├── tty2+ normal login
│   └── maintenance administrator + sudo
└── SSH
    └── maintenance / recovery
```

The RoomGoblin application and maintenance containers remain independent of this graphical session.

## Why the exact session model matters

Three implementation details were required during live validation:

1. **Use the systemd user D-Bus session.** `.xinitrc` exports `XDG_RUNTIME_DIR=/run/user/<uid>` and `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/<uid>/bus`. Do not replace this with a private `dbus-launch` session. Chromium Snap scope creation depends on the systemd user manager.
2. **Do not let Chromium inherit tty1 file descriptors.** The Chromium launch redirects stdin from `/dev/null` and stdout/stderr to files. Snap confinement rejected inherited `/dev/tty1` descriptors and caused a restart loop.
3. **Use the Snap-owned browser profile.** Do not point `--user-data-dir` at an arbitrary path under `~/.config`; AppArmor blocked creation of Chromium singleton/profile files there.

Chromium currently uses `--disable-gpu` for predictable rendering. Xorg still uses the NVIDIA display driver.

## NVIDIA/Xorg note

A host can have a working NVIDIA kernel module while still missing the Xorg display module. The live host initially had that mismatch.

For the validated Ubuntu 26.04 host the final matching package set was:

```text
nvidia-driver-610
nvidia-dkms-610
xserver-xorg-video-nvidia-610
```

with version `610.57.04-0ubuntu0.26.04.3`.

Do not blindly copy that version to another host. Install a mutually compatible kernel, userspace and Xorg driver set from one packaging family. Confirm:

```bash
nvidia-smi
find /usr/lib /lib -name nvidia_drv.so -print
dkms status | grep -i nvidia
```

If the NVIDIA kernel driver exists but `nvidia_drv.so` is missing, `deploy/configure-securly-kiosk.sh` refuses to continue rather than mixing driver families.

## Installation

Create a root-only configuration file. The URL must never be committed:

```bash
sudo install -d -m 0700 /etc/roomgoblin
sudo tee /etc/roomgoblin/securly-kiosk.env >/dev/null <<'EOF'
SECURLY_KIOSK_URL='https://pass.securly.com/kiosk/login?code=REPLACE_WITH_LOCAL_KIOSK_CODE'
SECURLY_KIOSK_ADMIN_USER='your-existing-admin-user'
EOF
sudo chmod 0600 /etc/roomgoblin/securly-kiosk.env
```

Then:

```bash
sudo bash /opt/classroom-hub/deploy/configure-securly-kiosk.sh install
```

The script creates/locks the `kiosk` account, installs the minimal X/Openbox/Chromium stack, configures tty1 autologin, preserves SSH, writes the local secret URL file, configures the NVIDIA Xorg device when an NVIDIA Xorg driver is already available, and installs the management helpers.

## Normal administration

```bash
sudo kiosk-status
sudo kiosk-restart
sudo kiosk-stop
sudo kiosk-start
sudo kiosk-logs
```

Physical recovery:

```text
Ctrl+Alt+F2
login as the maintenance administrator
sudo -i
```

Return to the kiosk:

```text
Ctrl+Alt+F1
```

SSH remains the preferred remote recovery path.

## Expected healthy state

`kiosk-status` should show:

- `getty@tty1.service` active with the `kiosk` session;
- Xorg on display `:0`;
- Openbox running;
- one Chromium browser process containing `--kiosk`;
- the attached output at the expected resolution;
- an X11 window titled similar to `Kiosk System - Securly Pass - Chromium`;
- an empty or stable Chromium restart log;
- SSH enabled/active;
- no failed systemd services.

The 2026-09-18 cold-boot acceptance had zero Chromium watchdog restarts after startup.

## Troubleshooting

### Chromium restarts every three seconds

Check:

```bash
sudo kiosk-logs
journalctl -b | grep -Ei 'chromium|snap-confine|file_inherit|tty1'
```

If Snap reports `file_inherit` against `/dev/tty1`, confirm the autostart command redirects all three standard file descriptors.

If the log says `is not a snap cgroup`, verify `.xinitrc` uses the systemd user bus and not `dbus-launch`.

### Chromium reports SingletonLock/Profile permission denied

Remove any custom `--user-data-dir` outside the Snap profile. The working deployment uses Chromium Snap's default profile beneath the kiosk user's `~/snap/chromium/` tree.

### Xorg loops and tty1 reaches start-limit-hit

Inspect:

```bash
grep -E '\(EE\)|Fatal' /home/kiosk/.local/share/xorg/Xorg.0.log
nvidia-smi
find /usr/lib /lib -name nvidia_drv.so -print
```

A missing Xorg NVIDIA module must be fixed with a matching driver package before restarting tty1.

### Maintenance commands

Do not run `systemctl stop getty@tty1` from a shell that itself is running on tty1; that terminates the shell. Use SSH or `Ctrl+Alt+F2`.

## Rollback

The kiosk is intentionally separate from RoomGoblin application data. To stop it without removing files:

```bash
sudo kiosk-stop
```

To restore a normal tty1 login, remove the getty override, reload systemd and restart tty1 from SSH/another TTY:

```bash
sudo rm -f /etc/systemd/system/getty@tty1.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl restart getty@tty1.service
```

Removing the kiosk does not require changing RoomGoblin's database, Docker containers, scheduler, Morning Announcements, Background Music, displays, Veyon state or managed-device identities.

## Update contract

RoomGoblin source updates must not overwrite:

- `/etc/roomgoblin/securly-kiosk.env`
- `/etc/roomgoblin/securly-kiosk-url`
- the kiosk home/profile/logs
- local Xorg/NVIDIA state
- the maintenance administrator account

Repository scripts and documentation must never contain the production kiosk code.
