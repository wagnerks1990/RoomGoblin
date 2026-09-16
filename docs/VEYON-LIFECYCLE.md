# Veyon Lifecycle Management

RoomGoblin treats Veyon as a native host-managed integration. `veyon.service` and `veyon-webapi.service` remain systemd services on the Ubuntu appliance rather than RoomGoblin containers.

## GUI update workflow

Administrators can use **Settings → Integrations & Hardware → Veyon Classroom Computers → Veyon lifecycle** to:

- check the configured apt package feed for Veyon updates;
- compare the apt candidate with the latest upstream GitHub release when outbound GitHub access is available;
- see when the configured apt source is behind upstream;
- start the existing guarded RoomGoblin host-update workflow when a Veyon package update is available;
- see whether a host update is already running or a reboot is required.

The browser talks only to same-origin RoomGoblin administrator APIs. It never connects directly to GitHub.

## Update boundary

Veyon is installed as a native package, so RoomGoblin deliberately reuses the appliance host package updater instead of introducing a second package-management path.

The **Install available update** action therefore starts the normal guarded host update. It can install other pending Ubuntu or third-party package updates in addition to Veyon. The confirmation dialog states this explicitly.

The lifecycle API refuses to start an update when the configured apt sources do not currently offer a Veyon package update.

## Upstream release check

RoomGoblin requests the latest public release metadata from the official `veyon/veyon` GitHub repository on the server side. This check is informational:

- apt remains the trusted installation source;
- RoomGoblin does not download or execute GitHub release binaries directly;
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

1. verify Veyon/WebAPI service health;
2. verify the endpoint appears under its stable hostname identity;
3. verify thumbnail and enlarged screen-preview startup;
4. verify screen lock/unlock and input lock/unlock;
5. verify text messages;
6. verify teacher demonstration/broadcast start and stop;
7. verify user/session information updates;
8. change the endpoint's DHCP address and verify RoomGoblin follows the hostname;
9. if multiple Veyon authentication keys exist, verify the previously successful key preference follows the device;
10. verify update/reboot state in **Infrastructure & Recovery**.

## Rollback considerations

RoomGoblin does not implement a parallel Veyon package rollback mechanism. Use the distribution/package-source rollback procedure appropriate for the installed Veyon packages if a Veyon release itself must be downgraded. RoomGoblin application rollback does not downgrade native host packages.
