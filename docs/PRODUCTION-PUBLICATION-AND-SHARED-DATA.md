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

The Hub runs as UID/GID `10001:10001`. The maintenance container must be able to read persistent application assets for operational and full-recovery backups. Newly created Hub files therefore use runtime umask `0027`, producing normal files as `0640` and directories as `0750` unless a more restrictive explicit mode is required.

This preserves the intended boundary:

- owner: read/write;
- group `10001`: read access, with directory traversal where required;
- other users: no access.

The Hub startup wrapper `tools/start-roomgoblin.sh` establishes the umask before Node starts. Do not remove this wrapper or replace it with a runtime that inherits an unknown host/container umask.

### Resumable upload session permissions

In-progress resumable uploads are included in operational backups. Session directories therefore use `0750` and chunk/metadata files `0640`, matching the shared-data contract. Explicit `0700` directories or `0600` chunk files block maintenance backup traversal and cause production updates to fail safely before mutation.

### Media-upload incident

A large uploaded MP4 was observed as mode `0600`. The Hub itself could use the file, but the maintenance container could not read it during the mandatory operational safety backup. The update then stopped before service mutation with an apparently generic preflight failure.

The immediate repair for an affected installation is to restore group-read permission to the affected application-owned media file:

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
- Hub UID/GID `10001:10001` and runtime umask `0027` for ordinary shared application data;
- maintenance read access to backed-up application assets without granting world access;
- mandatory successful operational backup before runtime mutation;
- compatibility aliases, legacy command/journal names, data identities and the native main updater's recovery contract.

Any change to these behaviors must update this document, `docs/CI-WORKFLOWS.md`, the matching Wiki pages, and AI-maintainer guidance.


### Large operational archives

Operational backups are written with the system Info-ZIP streaming writer and ZIP64 support rather than buffering all entries through AdmZip. This is required when shared media pushes an operational archive beyond Node's approximately 2 GiB Buffer ceiling. The streaming path preserves the same backup filters, rejects symlinks/special files before archive creation, adds the SQLite `.backup` snapshot under the canonical database name, writes the recovery manifest, and keeps the final archive mode at `0600`.
