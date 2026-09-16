# Veyon Lifecycle

RoomGoblin keeps Veyon as a native Ubuntu/systemd integration and adds an administrator update workflow without exposing host credentials to the browser.

## Check for updates

Open **Settings → Integrations & Hardware → Veyon Classroom Computers → Veyon lifecycle** and choose **Check Veyon updates**.

RoomGoblin checks:

- the configured apt sources for Veyon package updates;
- the latest official `veyon/veyon` GitHub release when outbound GitHub access is available;
- whether the apt candidate is behind the latest upstream release;
- whether a host update is already running;
- whether the appliance currently requires a reboot.

The browser talks only to RoomGoblin. GitHub and maintenance credentials stay server-side.

## Install an available update

When apt offers a Veyon package update, **Install available update** starts RoomGoblin's existing guarded host package updater.

Because Veyon is a native host package, this operation can also install other pending Ubuntu/third-party package updates. The GUI asks for confirmation before starting it.

RoomGoblin does not download or execute Veyon binaries directly from GitHub. The official release check is informational; apt remains the installation source.

## Native service recovery

RoomGoblin expects native `veyon.service` and `veyon-webapi.service` when the integration is configured. The WebAPI normally runs `veyon-cli webapi runserver` on TCP `11080`.

Package replacement can stop `veyon.service`, which also stops the WebAPI because the WebAPI requires Veyon. RoomGoblin's guarded host updater installs a persistent systemd drop-in at `/etc/systemd/system/veyon.service.d/roomgoblin-webapi.conf` containing `Wants=veyon-webapi.service`. It enables both native units and, when Veyon was active before an update, verifies that both are active again afterward.

An installed but stopped WebAPI is shown as installed/stopped rather than incorrectly reported as missing.

Verify with:

```bash
systemctl is-enabled veyon.service veyon-webapi.service
systemctl is-active veyon.service veyon-webapi.service
systemctl cat veyon.service
ss -lntp | grep ':11080'
```

`GET /` on port `11080` may return `404 Invalid command or non-matching HTTP method`. That is a valid reachability response and is not proof that endpoint authentication or classroom controls work.

## After upgrading

Validate both native services and port `11080`, then test one non-critical workstation first: thumbnail and enlarged screen preview, screen and input lock/unlock, text message, demonstration/broadcast, user/session state, DHCP address changes, and multi-key authentication behavior.

RoomGoblin application rollback does not downgrade native Veyon packages. If a Veyon release itself must be rolled back, use the host package-source rollback procedure.
