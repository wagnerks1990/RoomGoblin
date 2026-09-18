# Release and Upgrade Process

See [Alpha.82 upgrade recovery](Alpha82-Upgrade-Recovery) for fixes to the live
alpha.76 upgrade path, shared database/ADB permissions, and signing migration.

## Versioning

RoomGoblin uses semantic-style prerelease versions during development:

```text
1.0.0-alpha.N
1.0.0-beta.N
1.0.0
```

The `alpha` container channel tracks alpha builds. `latest` remains reserved for stable releases.

Production images are currently validated for `amd64` only. Do not publish or
document `arm64` support until the Hub, maintenance image, and bundled
Android/ADB toolchain pass the complete release matrix on that architecture.

## Current deployment invariant

The current appliance is intentionally HTTP-only. The release must contain only:

```text
classroom-control-hub
classroom-control-hub-maintenance
classroom-hub-host-agent.service
```

Caddy/TLS is not part of the current Compose stack or release-health gate. HTTPS will be reintroduced later as a separate reviewed feature.

## Release checklist

Before publishing a release:

1. Update `VERSION`.
2. Update package and embedded component versions.
3. Search for stale prior version strings.
4. Run Node/Python/controller/Compose validation.
5. Build the main and maintenance Docker images.
6. Verify direct HTTP startup and `/health` on port 3000.
7. Verify database compatibility and persistent mounts.
8. Verify the shared data root remains `root:10001` with the documented modes.
9. Verify the master encryption key is preserved across upgrades.
10. Verify `MAINTENANCE_TOKEN` is non-empty before container recreation.
11. Verify Host Agent service/socket and maintenance access.
12. Test a cold start where the main application is initially absent; maintenance readiness must not deadlock Compose.
13. Test display reconnect/version convergence.
14. Test automations and manual Run Now/Test Now.
15. Validate all migrated class schedule times and automation actions before declaring readiness.
16. Test class timers and explicit continuation rules.
17. Test Morning Announcements playback, HLS detection, audio controls, priority lock, and release.
18. Verify post-announcement failsafe scheduler resync restores the currently applicable automations.
19. Test Background Music pause/resume/recovery.
20. Verify unrelated integration failures do not contaminate other health indicators.
21. Verify slow optional integration checks do not block the Overview UI.
22. Verify an upgrade from the previous live-test release removes any legacy `classroom-control-hub-tls` orphan.
23. Update `CHANGELOG.md`, relevant `docs/` pages, `AGENTS.md`/`docs/AI-CONTEXT.md` when applicable, and the matching `wiki/` mirror pages.

A release is not complete until backend, controller, display renderer, maintenance agent, and Host Agent version surfaces converge and the backend reports database/scheduler readiness.

## Production Git upgrade

The standard production checkout is `/opt/classroom-hub`.

Back up first, then use the supported installer so host permissions, secrets, and migration cleanup are applied:

```bash
sudo cp -a /opt/classroom-hub "/opt/classroom-hub-backup-before-update-$(date +%Y%m%d-%H%M%S)"
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The production installer resolves the checked-out commit and pulls both matching
`sha-<commit>` images. It fails without replacing running containers if those
validated artifacts are not available. Local compilation is development-only and
requires the explicit `sudo bash install.sh --build-local` option.

Development rebuild after a valid installation:

```bash
sudo docker compose build --no-cache
sudo docker compose up -d --remove-orphans
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

Verify the Host Agent after migrations that touch installation paths or systemd:

```bash
sudo systemctl status classroom-hub-host-agent.service --no-pager -l
sudo test -S /run/classroom-control-hub/host-agent.sock
sudo docker exec classroom-control-hub-maintenance ls -la /run/classroom-control-hub/
```

After an upgrade, hard-refresh the controller when frontend assets changed and verify physical display clients converge to the same release version.

## Image tags

Intended GHCR pattern:

```text
ghcr.io/wagnerks1990/roomgoblin:alpha
ghcr.io/wagnerks1990/roomgoblin:1.0.0-alpha.N
```

The maintenance image uses the corresponding maintenance package/tag.

CI also publishes identical transitional aliases at
`ghcr.io/wagnerks1990/classroom-control-hub*` for existing automation. New
deployments use the canonical RoomGoblin names. Do not remove the aliases
without a tested migration and rollback plan.

## Rollback

If the release has no incompatible database migration, restore the previous known-good source/image while preserving persistent runtime state.

If the release changes the database schema, follow release-specific rollback instructions and restore the matching database backup if required.

## Web-managed updates

The **System updates** page tracks merged commits on the trusted `main` branch. It does not wait for or select alpha/beta/stable GitHub release tags. **Check GitHub** compares the installed Git commit with the latest `wagnerks1990/RoomGoblin:main` commit and offers an update only when the current checkout is clean and can fast-forward to that exact commit.

Installing from the GUI still uses the production update transaction rather than a browser-side Git pull. The Hub rechecks the selected main commit immediately before handoff, then the native updater independently fetches `origin/main`, verifies ancestry, waits for both exact `sha-<commit>` CI images, checks their embedded revision labels, creates an operational recovery backup, performs selective reconciliation, and verifies application/maintenance/Host Agent health. Missing or failed CI artifacts stop the operation before source/runtime mutation. Automatic updates use the same main-commit flow during the configured maintenance window.

Current update health requirements remain:

- backend HTTP `/health` succeeds and reports the expected version;
- database and scheduler readiness pass;
- maintenance is healthy and reports the expected version;
- Host Agent is healthy and reports the expected version;
- the exact expected Hub and maintenance image identities are active when those components changed;
- ADB/runtime storage checks pass;
- no TLS/Caddy dependency is required by the current direct-HTTP appliance health gate.

The GUI does not accept an arbitrary SHA from the operator. A merge may appear as available before its exact images finish publishing; in that case the native image-readiness gate fails closed without switching source or containers. Retry after the exact-SHA publication completes.

Every mutating update creates a pre-update operational backup after source/image preflight. Deployment failure automatically restores the prior commit, retained container image IDs, environment, Host Agent unit, and matching backup. **Revert Last Upgrade** preserves the current state first and then restores the previous verified set; it never resolves a moving branch/tag for rollback.

The updater runs from a private host-side snapshot so installer replacement cannot corrupt an active transaction. Pending mutation journals survive interruption and are resumed by the Host Agent. Do not manually start `classroom-hub-app-update.service` without a pending request file; that oneshot is an internal transaction runner, not the user-facing update command.

A GitHub read token is optional for the public repository and is stored encrypted when configured. Update history shows the exact deployed/main commit in addition to the application version so commits that share the same prerelease version remain distinguishable. Automatic updates are off by default and run only inside the configured maintenance window.

Container publication requires the exact main commit to pass Validate, Display browser regression and Security gates before the immutable image pair is published. Do not retag another build or bypass this gate. Keep `classroom-control-hub-recovery:*` images while **Revert Last Upgrade** remains available.


## HTTPS reintroduction acceptance

Do not add HTTPS back as a minor Compose tweak. A future HTTPS release must have dedicated acceptance tests for DNS/SNI, certificate trust/distribution, HTTP-to-HTTPS migration, reverse-proxy trust configuration, cold-start ordering, and rollback to the HTTP-only release.

## Release acceptance

A release is not considered production-ready merely because the container starts. Validate the classroom behaviors that can disrupt instruction: display state, timers, announcements, audio arbitration, schedules, integration health, Host Agent access, and recovery after reconnects.

## Selective production updates

Normal published-source CLI updates support `--plan` and `--full`. The native runner compares running component revisions and the saved deployment configuration, backs up before runtime changes, and recreates only changed components. Unknown inputs, migrations, versions or configuration drift invoke full installer reconciliation. Docs-only changes need no service restart. Pending interrupted deployments roll back through the native update journal. See [[Production-Updates]] and [[CI-Workflows]] for operating details and limits.
