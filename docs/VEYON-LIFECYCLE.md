# Veyon Lifecycle Management

RoomGoblin treats Veyon as a native host-managed integration. `veyon.service` and `veyon-webapi.service` remain systemd services on the Ubuntu appliance rather than RoomGoblin containers.

## GUI update workflow

Administrators can use **Settings → Integrations & Hardware → Veyon Classroom Computers → Veyon lifecycle** to:

- check the configured apt package feed for Veyon updates;
- compare the apt candidate with the latest upstream GitHub release when outbound GitHub access is available;
- see when the configured apt source is behind upstream;
- start the guarded RoomGoblin update workflow when either apt offers Veyon or the official Veyon GitHub release contains an exact checksum-pinned Ubuntu package for this appliance;
- see whether a host update is already running or a reboot is required.

The browser talks only to same-origin RoomGoblin administrator APIs. It never connects directly to GitHub.

## Update boundary

Veyon is installed as a native package, so RoomGoblin deliberately reuses the appliance host package updater instead of introducing a second package-management path.

The **Install available update** action therefore starts the normal guarded host update. It can install other pending Ubuntu or third-party package updates in addition to Veyon. The confirmation dialog states this explicitly.

The lifecycle API prefers apt. If the configured Veyon PPA is behind, it may instead install the exact official `veyon/veyon` GitHub release asset only when the release provides a matching Ubuntu `amd64` DEB with GitHub's SHA-256 digest. The Host Agent independently reconstructs and validates the expected release URL, package filename, distribution version, architecture, checksum, package name, and package version before installation. Arbitrary package URLs are rejected. Same-version and downgrade requests are also rejected.

## Native service recovery

RoomGoblin depends on both native services when Veyon is configured:

- `veyon.service` provides the native Veyon service;
- `veyon-webapi.service` runs `veyon-cli webapi runserver`, normally on TCP `11080`.

A package transaction can stop `veyon.service`. Because the WebAPI unit requires Veyon, systemd also stops `veyon-webapi.service`. Starting only the replacement `veyon.service` does not normally restart a dependent unit that was stopped with it.

The guarded RoomGoblin host updater therefore installs `/etc/systemd/system/veyon.service.d/roomgoblin-webapi.conf` when both native units exist. The drop-in adds `Wants=veyon-webapi.service`, enables both units, preserves whether Veyon was expected to be running before the package transaction, and verifies that both services are active again after the update when they were previously active. The drop-in lives under `/etc`, so ordinary package replacement of the vendor Veyon unit does not overwrite it.

An installed but stopped `veyon-webapi.service` is **not** the same as a missing service. RoomGoblin reports that state as installed/stopped and preserves the host-managed integration instead of incorrectly telling the administrator to reinstall Veyon.

Useful checks after package work are:

```bash
systemctl is-enabled veyon.service veyon-webapi.service
systemctl is-active veyon.service veyon-webapi.service
systemctl cat veyon.service
systemctl status veyon-webapi.service --no-pager -l
ss -lntp | grep ':11080'
```

A request to `GET /` on port `11080` can legitimately return `404 Invalid command or non-matching HTTP method`. That proves only that the WebAPI process is reachable; it does not prove endpoint authentication, screenshots, or classroom-control operations.

## Upstream release check

RoomGoblin requests the latest public release metadata from the official `veyon/veyon` GitHub repository on the server side. This check is informational:

- apt remains the preferred installation source;
- when apt lags, RoomGoblin may download only the exact official Veyon Ubuntu DEB advertised by the same GitHub release metadata, verify its SHA-256 digest and DEB identity, then install it through the guarded native Host Agent;
- an upstream version newer than the apt candidate is reported as **configured apt source is behind upstream**;
- GitHub lookup failure does not prevent apt package status from being displayed.

## Security

- lifecycle routes require RoomGoblin administrator authorization;
- the maintenance token stays server-side;
- the browser receives package names/version metadata and update status, not maintenance credentials;
- package installation still requires an explicit confirmation value at the RoomGoblin API and the existing `INSTALL_UPDATES` confirmation at the maintenance/Host Agent boundary;
- native service ownership, encrypted Veyon authentication keys, and RoomGoblin database state are not replaced by the lifecycle check.

## Recommended Veyon upgrade acceptance

For a major/minor Veyon change, validate one non-critical endpoint before broad rollout:

1. verify both `veyon.service` and `veyon-webapi.service` are enabled and active;
2. verify TCP `11080` is listening and the WebAPI is reachable;
3. verify the endpoint appears under its stable hostname identity;
4. verify thumbnail and enlarged screen-preview startup;
5. verify screen lock/unlock and input lock/unlock;
6. verify text messages;
7. verify teacher demonstration/broadcast start and stop;
8. verify user/session information updates;
9. change the endpoint's DHCP address and verify RoomGoblin follows the hostname;
10. if multiple Veyon authentication keys exist, verify the previously successful key preference follows the device;
11. verify update/reboot state in **Infrastructure & Recovery**.

## Rollback considerations

RoomGoblin does not implement a parallel Veyon package rollback mechanism. Use the distribution/package-source rollback procedure appropriate for the installed Veyon packages if a Veyon release itself must be downgraded. RoomGoblin application rollback does not downgrade native host packages.

## Installed version and browser feature discovery

RoomGoblin reads installed Veyon package versions from the Host Agent's fixed
`dpkg-query` inventory independently of apt's pending upgrades. The installed
version remains visible when no upgrade is pending. Mixed package versions are
reported rather than selecting an arbitrary component. Missing inventory means
unknown, never an assumed 4.9.7 or 4.11.2. This is host package inventory, not
proof of the loaded WebAPI binary or Windows endpoint version; services may need
a restart after an external upgrade.

The feature catalog includes newly advertised names with an explicit unmapped
status. Advertisement does not prove endpoint support or a working browser
implementation. Remove version-specific absence claims from GUI text. Native
launchers and isolated plugin packages do not satisfy the web-GUI integration
goal: keyboard/mouse, clipboard, two-way chat and file operations need actual
authenticated browser/backend/native adapters and endpoint acceptance tests.
