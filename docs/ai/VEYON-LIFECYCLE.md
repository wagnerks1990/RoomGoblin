# AI Context: Veyon Lifecycle

Treat Veyon as a native host-managed integration, not a RoomGoblin container.

## Invariants

- `veyon.service` and `veyon-webapi.service` remain native systemd services.
- An inactive/stopped `veyon-webapi.service` is installed state, not missing state. Do not tell operators to reinstall Veyon merely because the unit is inactive.
- When both native Veyon units exist, preserve the systemd relationship that starting `veyon.service` also wants `veyon-webapi.service`. The guarded host updater owns the persistent `/etc/systemd/system/veyon.service.d/roomgoblin-webapi.conf` drop-in and must not remove it during package updates.
- Before a host package transaction, remember whether the native Veyon integration was expected to be active. If it was active, both native units must be active again before the guarded update is accepted.
- Apt/package sources are the installation authority. The upstream GitHub release is informational only.
- Never make the browser fetch GitHub directly; lifecycle checks are server-side and projected through same-origin admin APIs.
- Never expose `MAINTENANCE_TOKEN` or Host Agent credentials to the browser.
- Veyon package installation must reuse the existing guarded host-update transaction rather than inventing an unbounded shell/package endpoint.
- The GUI must disclose that starting a Veyon update can also install other pending Ubuntu/third-party package updates.
- Refuse the dedicated Veyon update action if the configured apt sources do not currently offer a Veyon package update.
- GitHub release lookup failure must not hide apt status.
- Do not download/execute release binaries directly from GitHub.
- RoomGoblin application rollback does not imply native Veyon package rollback.
- A root WebAPI HTTP 404 establishes reachability only. Never infer authentication, screenshots, or control success from it.

## Service-state interpretation

The Host Agent has policy entries for native services even when a unit can be absent. Maintenance code must distinguish three cases:

1. unit missing / not loaded;
2. unit installed but stopped;
3. unit active.

For compatibility with older Host Agent responses, an inactive/disabled service with an empty description can be treated as absent; an inactive service with a real unit description remains installed. New UI/backend changes must preserve this distinction.

## Release status

The server may expose:

- Veyon package rows from the existing host update inventory;
- installed/candidate version when apt reports an upgrade;
- latest upstream release tag/version and publication metadata;
- whether upstream is newer than the configured apt candidate;
- running host-update/reboot state.

Keep these values informational and do not infer that an upstream release is installable unless apt offers it.

## Upgrade acceptance

After a Veyon upgrade, first verify both native services are enabled and active and TCP `11080` is listening. Then validate WebAPI reachability, thumbnail and enlarged screen-preview behavior, screen/input lock, text message, demonstration/broadcast, user/session reporting, DHCP hostname identity, and multi-key affinity on a non-critical workstation before classroom-wide rollout.
