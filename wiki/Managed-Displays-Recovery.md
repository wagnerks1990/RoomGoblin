# Managed Displays recovery

The Classroom Overview has a **Managed Displays** link beside **Refresh**. It opens `/managed-displays/` for Android / Google TV enrollment and control.

## ADB key storage and inventory permissions

The maintenance container intentionally runs with a read-only root filesystem and
all Linux capabilities dropped. RoomGoblin shares the named Docker volume
`classroom-control-hub-android-adb` using separate access modes:

```text
Hub:         /app/data/android-tv/.android           writable
Maintenance: /managed/classroom-hub/data/android-tv/.android  read-only
```

The Hub can write its persistent client identity; maintenance can read the same
keys without changing them. Native host layout repair owns permission changes:
0750 for the directory and 0640 for the key pair, owned by 10001:10001. Do not
make the maintenance mount writable, grant privileged mode or add capabilities.

A Compose-file update is not enough by itself: Docker must recreate the affected
core containers before new mounts apply. The updater verifies maintenance can
read its ADB identity directory and existing inventory. Release acceptance also
checks Hub write access, maintenance's read-only mount and unchanged trust keys.

The nested mount also depends on the host-backed parent directory being traversable. The supported layout is:

```text
/opt/classroom-hub/data/android-tv/    root:10001  2770
devices.json                           root:10001  0660
.android/                              dedicated Docker volume
```

An unreadable `devices.json` must be treated as an error. It must never be silently converted into `0 devices`.

The staged Android APK and JSON metadata are not a trust anchor because they live in the writable managed-data tree. Before every readiness response or installation, maintenance validates the APK signer against the protected `/signing/android-agent` keystore. The nested identity is the same pair exported by Full Recovery; complete older identities at the direct `/signing` root migrate without regeneration.

Each successful probe records the device's Android ID. When DHCP or the randomized ADB port changes, recovery accepts an already-authorized mDNS endpoint only when that ID matches; a common firmware/build fingerprint is never sufficient.

For an affected appliance, use the supported updater during the administrator's
authorized maintenance window. It verifies exact images and creates the required
backup before reconciliation. Then perform these read-only storage checks:

```bash
cd /opt/classroom-hub
sudo bash deploy/update-production.sh
sudo docker compose exec -T classroom-hub sh -lc 'test -w /app/data/android-tv/.android'
sudo docker compose exec -T maintenance-agent sh -lc 'test -r /managed/classroom-hub/data/android-tv/.android'
sudo docker inspect --format '{{range .Mounts}}{{if eq .Destination "/managed/classroom-hub/data/android-tv/.android"}}{{.Name}} writable={{.RW}}{{end}}{{end}}' classroom-control-hub-maintenance
```

The final command must show the named volume with `writable=false`. Refresh
**Managed Displays** and investigate any remaining error without replacing trust
keys or blindly re-pairing. Do not bypass the supported transaction with ad hoc builds.

## Display Agent says `Not installed` but Launch Agent works

On the validated Onn 4K Streaming Device running Android 14, `dumpsys package org.roomgoblin.display` can block while the Display Agent is installed and running. The primary status probe therefore must not depend on `dumpsys package`.

Use these authoritative checks:

```bash
sudo docker compose exec maintenance-agent adb -s <serial> shell pm path org.roomgoblin.display
sudo docker compose exec maintenance-agent adb -s <serial> shell pidof org.roomgoblin.display
```

`pm path` determines installed/not installed. `pidof` independently determines running/stopped. Optional version/metadata probes may enrich status only and must never downgrade a confirmed installed/running state.

## Regression rules

Do not remove `--force-recreate` from the application updater's core-service deployment step unless mount-change reconciliation is replaced with an equally explicit, tested mechanism. Do not weaken the maintenance security boundary to solve ADB storage permissions. Do not catch inventory filesystem/JSON failures and return an empty inventory. Do not put `dumpsys package` back into the critical agent-status path.

For detailed verification, live validation notes, and security rationale, see `docs/MANAGED-DISPLAYS-RECOVERY.md` in the repository.
