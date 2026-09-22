# AI Context: Production Shared Data and Backup Readability

Use this file whenever changing Hub process startup, media/presentation uploads, persistent-data ownership, operational/full-recovery backups, or production-update preflight.

## Runtime identity and umask

- The Hub runs as UID/GID `10001:10001`.
- The maintenance container requires group-read access to ordinary application assets included in backups.
- `tools/start-roomgoblin.sh` must establish `umask 0027` before Node starts.
- Normal application-created files should therefore be `0640`; normal directories should be `0750`, unless code intentionally applies a stricter mode.
- Other-user access remains disabled.

Do not replace this with `0777`, a blanket recursive chmod, or an unknown inherited runtime umask. Secrets, ADB private material, Android signing material, recovery envelopes, and backup artifacts may have intentionally stricter explicit modes and must not be relaxed just to satisfy a generic permission check.

## Resumable upload session permissions

Resumable upload sessions are ordinary shared application data, not secrets. Their root/session directories must be `0750` and chunk/metadata files `0640` so the maintenance container can include an in-progress upload in the mandatory operational backup. Do not use explicit `0700` session directories or `0600` chunk files; those override the runtime umask and make update preflight fail with `EACCES` on `data/media-upload-sessions`.

## Known failure mode

A large uploaded MP4 was created mode `0600`. The Hub could read it, but maintenance could not read it while creating the mandatory operational safety backup. The production updater correctly stopped before mutating services.

The permanent prevention is the Hub runtime umask, not a broad permission relaxation.

For an already-affected ordinary media file, repair only the bad application-owned asset, for example:

```bash
sudo chmod 0640 /opt/classroom-hub/data/media/<file>
```

Then verify no media asset lacks the shared group or group-read bit.

## Update safety invariant

A production update must complete its operational safety backup before changing running services. Never bypass that backup to make an update proceed.

When backup returns `EACCES`:

1. inspect the exact unreadable path;
2. determine whether it is ordinary application data or intentionally restricted secret material;
3. repair only an incorrect ownership/mode;
4. verify the operational backup succeeds;
5. rerun the supported production updater.

## Regression expectations

Tests must preserve:

- `Dockerfile` starts the Hub through `tools/start-roomgoblin.sh`;
- the wrapper uses POSIX `sh`, sets `umask 0027`, and executes the existing startup-recovery entrypoint with `direct-display-compat.js`;
- startup recovery still runs before the main server;
- operational backup remains mandatory before production mutation.

## Documentation synchronization

Keep these synchronized when this contract changes:

- `docs/PRODUCTION-PUBLICATION-AND-SHARED-DATA.md`
- `wiki/Production-Publication-and-Shared-Data.md`
- `wiki/AI-and-Contributor-Guide.md`
- this file
- relevant production-image/startup regression tests.


### Large operational archives

Operational backups are written with the system Info-ZIP streaming writer and ZIP64 support rather than buffering all entries through AdmZip. This is required when shared media pushes an operational archive beyond Node's approximately 2 GiB Buffer ceiling. The streaming path preserves the same backup filters, rejects symlinks/special files before archive creation, adds the SQLite `.backup` snapshot under the canonical database name, writes the recovery manifest, and keeps the final archive mode at `0600`.
