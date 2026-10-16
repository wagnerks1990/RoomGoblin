# Main publication and shared-data permissions

This page records the deployment invariants behind validated image publication, uploaded media permissions, operational backups, and selective updates. Its historical filename is retained for existing links.

## Exact-commit publication

Every push to `main` starts **Publish Main Images** directly. Publication waits for **Validate**, **Display browser regression**, and **Security gates** to pass for the exact same commit SHA before any image is deployable.

The publisher creates immutable commit tags for the Hub and maintenance images plus legacy compatibility aliases, then promotes `alpha` only while the validated SHA is still current `main`. No production/staging/development source branch is created or advanced.

Merged source is not automatically deployable; the commit-matched image pair must exist first. See [Main-based updates](Production-Updates) for the one-time old-updater migration, selective update command, PR settings and recovery.

## Android dependency reliability

The maintenance image builds the Android Agent APK from source. If external Maven/Google repositories temporarily fail and many otherwise valid dependencies disappear at once, the build retries up to three times and refreshes dependency resolution after the first failure. Package/version/APK verification remains mandatory, and a deterministic build failure still blocks publication.

## Shared persistent-data mode

The Hub runs as UID/GID `10001:10001`. The wrapper starts with umask `0027`, but storage/startup deliberately imposes private umask `0077`. Creation modes alone are therefore insufficient. Publish ordinary uploaded content explicitly as `0640` files and `0750` directories; keep the private process umask and secret protections unchanged. Maintenance reads these assets through shared GID 10001 without extra capabilities.

This gives the owner read/write, shared group read/traverse, and no access to other users.

Do not remove `tools/start-roomgoblin.sh`, inherit an unknown runtime umask, use `0777`, or recursively relax secrets/ADB/signing data.

### Resumable upload session permissions

Published resumable session metadata and committed chunks are included in operational backups. Session directories use `0750` and files `0640`, applied explicitly after creation or on their write descriptors. Unpublished `.tmp` session trees and temporary chunk/metadata files are excluded from both validation and ZIP creation. Presentation conversion stays in the existing excluded `presentation-upload-tmp` root until complete readable originals/PDFs/slides are published. Backups still fail closed on unreadable committed content.

## Media upload / backup failure

A large uploaded MP4 was observed as `0600`. The Hub could read it, but maintenance could not include it in the mandatory safety backup. The updater correctly stopped before changing services.

Existing affected assets require a separately approved bounded repair, with original modes/ownership/inodes recorded and symlinks, special files and hard-linked files rejected. See [Production Updates](Production-Updates). For one verified application-owned media file, the mode-only change would be:

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

If an update stops before mutation:

1. inspect `/var/lib/classroom-hub/app-update-status.json`;
2. confirm Hub and maintenance health;
3. run an operational backup explicitly;
4. identify the first unreadable persistent file if backup reports `EACCES`;
5. repair only that file's incorrect ownership/mode;
6. verify backup succeeds;
7. rerun `deploy/update-production.sh`.

Never bypass the mandatory safety backup to force an update through.

## AI / contributor rules

Preserve exact-SHA publication gating, the complete Hub+maintenance image pair, bounded Android dependency retries, Hub UID/GID `10001:10001`, the initial wrapper umask `0027`, private storage/startup umask `0077`, explicit content modes, maintenance read access without world access, and the mandatory pre-mutation operational backup. Main is the sole integration/update source; preserve legacy command names without restoring a separate branch-promotion requirement.
## Large operational archives and restore semantics

Operational backups intentionally exclude `classroom-hub/data/media`; uploaded media is replaceable content and is not part of the mandatory pre-update rollback set. Eligible operational state is streamed with system Info-ZIP/ZIP64 instead of being buffered into a single Node/AdmZip allocation. The archive still carries the SQLite snapshot and recovery manifest and retains the existing path, symlink/special-file, and private-permission protections. Top-level database identities under `classroom-hub/data` are excluded from the filesystem traversal and ZIP command; only the SQLite-safe canonical snapshot is added back. This prevents stale legacy databases from blocking or contaminating an operational backup.

A normal configuration-data restore preserves the appliance's current `data/media` directory because new operational archives do not contain media. Interrupted legacy restore recovery is different: older safety archives may contain media, so startup rollback must restore those archived media entries for backward compatibility.

