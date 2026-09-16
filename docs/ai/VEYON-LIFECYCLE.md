# AI Context: Veyon Lifecycle

Treat Veyon as a native host-managed integration, not a RoomGoblin container.

## Invariants

- `veyon.service` and `veyon-webapi.service` remain native systemd services.
- Apt/package sources are the installation authority. The upstream GitHub release is informational only.
- Never make the browser fetch GitHub directly; lifecycle checks are server-side and projected through same-origin admin APIs.
- Never expose `MAINTENANCE_TOKEN` or Host Agent credentials to the browser.
- Veyon package installation must reuse the existing guarded host-update transaction rather than inventing an unbounded shell/package endpoint.
- The GUI must disclose that starting a Veyon update can also install other pending Ubuntu/third-party package updates.
- Refuse the dedicated Veyon update action if the configured apt sources do not currently offer a Veyon package update.
- GitHub release lookup failure must not hide apt status.
- Do not download/execute release binaries directly from GitHub.
- RoomGoblin application rollback does not imply native Veyon package rollback.

## Release status

The server may expose:

- Veyon package rows from the existing host update inventory;
- installed/candidate version when apt reports an upgrade;
- latest upstream release tag/version and publication metadata;
- whether upstream is newer than the configured apt candidate;
- running host-update/reboot state.

Keep these values informational and do not infer that an upstream release is installable unless apt offers it.

## Upgrade acceptance

After a Veyon upgrade, validate WebAPI reachability, thumbnail and enlarged screen-preview behavior, screen/input lock, text message, demonstration/broadcast, user/session reporting, DHCP hostname identity, and multi-key affinity on a non-critical workstation before classroom-wide rollout.
