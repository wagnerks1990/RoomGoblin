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

## After upgrading

Validate one non-critical workstation first: thumbnail and enlarged screen preview, screen and input lock/unlock, text message, demonstration/broadcast, user/session state, DHCP address changes, and multi-key authentication behavior.

RoomGoblin application rollback does not downgrade native Veyon packages. If a Veyon release itself must be rolled back, use the host package-source rollback procedure.
