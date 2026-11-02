# Main publication and shared-data permissions

This document records the deployment invariants behind validated image publication, uploaded media permissions, operational backups, and selective updates. Its historical filename is retained for existing links.

## Exact-commit main publication

Every push to `main` starts `Publish Main Images` directly. Publication waits for `Validate`, `Display browser regression`, and `Security gates` to pass for the exact same commit SHA before any image is considered deployable.

The publisher creates immutable commit tags for both runtime images and both legacy aliases, then promotes `alpha` only while the validated SHA is still current `main`. No production/staging/development source branch is created or advanced.

A source commit is not deployable merely because it is merged. The main updater requires the exact commit-matched Hub and maintenance images before source/runtime changes. See [Main-based updates](PRODUCTION-UPDATES.md) for the one-time legacy-updater transition, selective update command, rollback, and PR settings. In the Wiki, use the matching **Production Updates** page.

## Maintenance image dependency retries

The maintenance image contains the Android Agent APK built from repository source. External Maven/Google repository outages can make many valid Android dependencies appear unavailable at once. The Docker build retries the Android release build up to three times and forces fresh dependency resolution after the first failed attempt.

Retries do not weaken validation. If the APK still cannot be built, or if package/version/SHA verification fails, the maintenance image fails and the image pair is not promoted.

## Shared persistent-data permissions

The Hub runs as UID/GID `10001:10001`. The wrapper starts with umask `0027`, but storage/startup deliberately imposes private umask `0077`. Creation modes alone are therefore insufficient. Publish ordinary uploaded content explicitly as `0640` files and `0750` directories; keep the private process umask and secret protections unchanged. The maintenance container reads these content assets through shared GID 10001 without extra capabilities.

This preserves the intended boundary:

- owner: read/write;
- group `10001`: read access, with directory traversal where required;
- other users: no access.

The Hub startup wrapper `tools/start-roomgoblin.sh` establishes the umask before Node starts. Do not remove this wrapper or replace it with a runtime that inherits an unknown host/container umask.

### Resumable upload session permissions

Published resumable session metadata and committed chunks are included in operational backups. Session directories use `0750` and files `0640`, applied explicitly after creation or on their write descriptors. Unpublished `.tmp` session trees and temporary chunk/metadata files are excluded from both validation and ZIP creation. Presentation conversion stays in the existing excluded `presentation-upload-tmp` root until complete readable originals/PDFs/slides are published. Backups still fail closed on unreadable committed content.

### Media-upload incident

A large uploaded MP4 was observed as mode `0600`. The Hub itself could use the file, but the maintenance container could not read it during the mandatory operational safety backup. The update then stopped before service mutation with an apparently generic preflight failure.

The following historical media repair is not an instruction to widen access automatically. Existing affected assets require a separately approved bounded repair, with original modes/ownership/inodes recorded and symlinks, special files and hard-linked files rejected. See the uploaded-content section in [Production Updates](PRODUCTION-UPDATES.md). For one verified application-owned media file, the mode-only change would be:

```bash
sudo chmod 0640 /opt/classroom-hub/data/media/<file>
```

Then verify that no media files are missing group read:

```bash
find /opt/classroom-hub/data/media -maxdepth 1 -type f \
  \( ! -group 10001 -o ! -perm -g=r \) \
  -printf '%u:%g %m %s %p\n'
```

A healthy result prints nothing.

Do not recursively make persistent data world-readable. Do not change the shared-data model to `0777`, and do not use a blanket `chmod -R` over secrets, backups, ADB keys, or signing material.

## Backup/update relationship

The native main updater performs a mandatory operational backup before mutating running services. If backup creation fails, the update must stop without recreating containers.

When diagnosing a stopped update:

1. inspect `/var/lib/classroom-hub/app-update-status.json`;
2. verify Hub and maintenance health;
3. run an operational backup explicitly;
4. inspect the first unreadable persistent file if backup returns `EACCES`;
5. repair only the incorrect ownership/mode;
6. verify backup succeeds;
7. rerun `deploy/update-production.sh`.

Do not bypass the safety backup to force an update through.

## AI/contributor invariants

Future automated changes must preserve all of the following:

- exact-SHA validation before image publication;
- complete Hub + maintenance image-pair publication before main source deployment;
- no separate source-branch promotion requirement during active development;
- bounded/fail-closed retry behavior for transient Android dependency resolution;
- Hub UID/GID `10001:10001`, the initial wrapper umask `0027`, private storage/startup umask `0077`, and explicit `0750`/`0640` content publication;
- maintenance read access to backed-up application assets without granting world access;
- mandatory successful operational backup before runtime mutation;
- compatibility aliases, legacy command/journal names, data identities and the native main updater's recovery contract.

Any change to these behaviors must update this document, `docs/CI-WORKFLOWS.md`, the matching Wiki pages, and AI-maintainer guidance.


### Large operational archives

Operational backups intentionally exclude `classroom-hub/data/media`; uploaded media is replaceable content and is not part of the mandatory update rollback set. Other operational state is written with the system Info-ZIP streaming writer and ZIP64 support rather than buffering all entries through AdmZip. The streaming path preserves the backup filters, rejects symlinks/special files before archive creation, adds the SQLite `.backup` snapshot under the canonical database name, writes the recovery manifest, and keeps the final archive mode at `0600`.
