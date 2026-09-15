# Production publication and shared-data permissions

This page records the production invariants behind validated image publication, uploaded media permissions, operational backups, and selective updates.

## Exact-commit publication

Every push to `main` starts **Publish Main Images** directly. Publication waits for **Validate**, **Display browser regression**, and **Security gates** to pass for the exact same commit SHA before any image is deployable.

The publisher creates immutable commit tags for the Hub and maintenance images plus legacy compatibility aliases, then promotes `alpha` and advances `production` only while the validated SHA is still current `main`.

Merged source is not automatically deployable; the commit-matched image pair must exist first.

## Android dependency reliability

The maintenance image builds the Android Agent APK from source. If external Maven/Google repositories temporarily fail and many otherwise valid dependencies disappear at once, the build retries up to three times and refreshes dependency resolution after the first failure. Package/version/APK verification remains mandatory, and a deterministic build failure still blocks publication.

## Shared persistent-data mode

The Hub runs as UID/GID `10001:10001`. Maintenance must read backed-up application assets. The Hub startup wrapper establishes umask `0027`, so ordinary new files are `0640` and directories are `0750` unless code deliberately chooses a stricter mode.

This gives the owner read/write, shared group read/traverse, and no access to other users.

Do not remove `tools/start-roomgoblin.sh`, inherit an unknown runtime umask, use `0777`, or recursively relax secrets/ADB/signing data.

## Media upload / backup failure

A large uploaded MP4 was observed as `0600`. The Hub could read it, but maintenance could not include it in the mandatory safety backup. The production updater correctly stopped before changing services.

For an affected application-owned media file:

```bash
sudo chmod 0640 /opt/classroom-hub/data/media/<file>
```

Then verify:

```bash
find /opt/classroom-hub/data/media -maxdepth 1 -type f \
  \( ! -group 10001 -o ! -perm -g=r \) \
  -printf '%u:%g %m %s %p\n'
```

A healthy result prints nothing.

## Update troubleshooting

If a production update stops before mutation:

1. inspect `/var/lib/classroom-hub/app-update-status.json`;
2. confirm Hub and maintenance health;
3. run an operational backup explicitly;
4. identify the first unreadable persistent file if backup reports `EACCES`;
5. repair only that file's incorrect ownership/mode;
6. verify backup succeeds;
7. rerun `deploy/update-production.sh`.

Never bypass the mandatory safety backup to force an update through.

## AI / contributor rules

Preserve exact-SHA publication gating, the complete Hub+maintenance image pair, bounded Android dependency retries, Hub UID/GID `10001:10001`, runtime umask `0027`, maintenance read access without world access, and the mandatory pre-mutation operational backup.
