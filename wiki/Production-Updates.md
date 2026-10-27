# Main-based updates during active development

`main` is the only integration and update branch. Use short-lived work branches,
checked pull requests into main, and **Publish Main Images**. There is no separate
production, staging or development branch/environment promotion. Existing legacy
branches are retained as history, not fetched or advanced as deployment sources.
The `update-production.sh` filename and native `published` journal action remain
compatibility identifiers; neither selects a production branch.

Main can move before its images finish building. The updater selects one exact
main commit and waits for its validated image pair before source/runtime changes.
Failed CI, missing images, a wrong revision or divergent history stops the update
without changing running services. Never retag another revision to satisfy it.

## Web System Updates

The administrator **System updates** page follows the trusted `main` branch, not semantic-version release tags. **Check GitHub** compares the installed Git commit with the latest merged commit on `wagnerks1990/RoomGoblin:main`. The GUI enables **Install Main Update** only when the installed checkout is a fast-forward ancestor of that exact main commit and has no unsupported tracked source edits. The two legacy tracked device-configuration files retain the native migration exception.

The browser never performs a Git pull itself and never treats a merge alone as deployable. Installation hands the exact 40-character main commit to the native `published` transaction. That transaction re-fetches trusted `origin/main`, re-verifies ancestry, waits for the exact `sha-<commit>` Hub and maintenance image pair, verifies image revision labels, creates the operational recovery backup after preflight, applies the selective component plan, and health-checks or rolls back. If CI images for the newest merge are still building, the install attempt fails closed before source/runtime mutation and can be retried after publication completes.

Automatic application updates use the same main-commit path during the configured maintenance window. The GitHub token remains optional for the public repository and is only used for read-only GitHub metadata access. The previous-release rollback control remains available independently of how the current main commit was selected.

## Normal update

Status polling remains available during a Full Recovery export freeze. It defers
the Hub's history-cache write until the next unfrozen poll, including responses
that arrive after freeze acquisition. The native transaction journal remains the
authoritative update record; installation, backup and rollback policy is unchanged.

### Uploaded content and backup permissions

The Hub's storage/startup modules deliberately set `umask 0077` for private
runtime state. A requested `mode: 0750` or `0640` at creation is still filtered
by that umask; rename preserves the restrictive mode and converters inherit it.
Uploaded presentation originals, rendered PDFs/JPEGs, media and committed
resumable-upload files therefore explicitly apply `0750` directories / `0640`
files before publication through `src/content-permissions.js`. Ownership stays
with the application; no process-wide umask, capabilities or secret modes change.

Installer ownership normalization excludes `data/backups`: maintenance-owned
private `0600` rollback archives must not become application-owned, because the
hardened maintenance container cannot override their owner permissions. Existing
archive ownership is preserved; no unrelated private state is relaxed.

Presentation conversion runs in `data/presentation-upload-tmp`, which operational
backups already exclude. In-flight resumable `.tmp` files/directories are also
excluded consistently from validation and ZIP creation. Complete presentation
assets, session metadata and committed chunks remain in operational backups;
the existing replaceable `data/media` exclusion is unchanged. Backups must still
fail on unreadable committed state instead of skipping it or bypassing the gate.

Existing `0700`/`0600` presentation assets need a separately approved, bounded
repair before an old installed updater can create its required backup. Do not
recursively chmod/chown `data/`, add host users to GID 10001, grant world access,
or weaken the maintenance container. Inventory only the affected presentation
subtrees, reject symlinks/special files/hard-linked files and unexpected ownership,
and save a root-private manifest of each path, inode, owner/group and original
mode before changing only verified application-owned directories to `0750` and
files to `0640`. GID 10001 receives read/traverse access, not write access. Leave
Android trust, signing, credentials, screenshots and all other state untouched.
Restore the recorded modes only on the matching paths/inodes if repair is aborted.

After approved repair, require a successful ordinary operational backup, archive
inspection, checksum verification and SQLite integrity check. Deploy the fix only
after its tests pass, it is reviewed/merged with authorization and the exact main
image pair is published; use the normal updater below. Retain previous immutable
images, environment and matching backup for the runner's normal rollback. Test a
new presentation conversion and an active resumable upload followed by another
operational backup; do not use classroom playback commands as a permission test.

Regression coverage: `node --test test/content-backup-permissions.test.js` on
Linux, including a root-only fixture that drops to a different UID in GID 10001
and invokes the real streaming ZIP writer. It also reproduces the old `EACCES`,
keeps private staging/secrets excluded and checks that `0077` remains unchanged.


```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh --plan
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The optional plan fetches main and reports component decisions without
changing the checkout or services. A plan is not proof images are ready. Normal updates use the native runner's
appliance lock, durable journal, operational backup and health/rollback checks.
Both published manifests must exist. Only changed images are downloaded and their
OCI revision labels must match the exact selected commit before source switches.
Docker reuses layers it already has; complete images remain the deployment unit.

| Changed inputs | Normal action |
| --- | --- |
| Documentation and tests outside packaged inputs | Advance source; no backup, image download or restart |
| Hub application or controller/display assets | Back up; recreate Hub only |
| Maintenance or Android APK inputs | Back up; recreate maintenance only |
| Native Host Agent Python | Back up; refresh Host Agent only |
| Schema/startup recovery, version, deployment/configuration, unknown inputs | Full installer reconciliation |
| Missing revision history, unverified deployment record, changed resolved Compose configuration | Full installer reconciliation |

Each running image's actual OCI revision is compared independently with the
selected commit. `/var/lib/classroom-hub/deployment.json` records verified host
source and a hash of resolved deployment configuration; it contains no raw
configuration or secrets. A source checkout alone is not proof of deployment.
`ROOMGOBLIN_HUB_TAG` and `ROOMGOBLIN_MAINTENANCE_TAG` retain explicit image choices
in `.env`, falling back to the legacy `CLASSROOM_CONTROL_HUB_TAG` when absent.
Unchanged components may report older source revisions but must still pass version
convergence. Version changes force all components to update.

Use a full reconciliation for repair or to consume rebuilt base/system packages
when application source has not changed:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh --full
```

Do not pull `main` before routine updates. Ahead/divergent checkouts fail closed;
there is no silent source downgrade. Tracked edits and unrelated branches are
rejected. A detached checkout left by release/recovery is supported only when
its current commit and any existing local main can fast-forward to the selected
main commit. Successful source updates switch to main without deleting the old
branch. A single-branch production clone's fetch mapping is migrated to main.
The updater never resets an unrelated/divergent main branch to repair it.

## One-time transition from the old production updater

An old on-disk script cannot discover this change because it follows the retired
production branch. Download the reviewed main updater outside the checkout once:

```bash
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/wagnerks1990/RoomGoblin/main/deploy/update-production.sh \
  -o /tmp/roomgoblin-main-update.sh
sudo bash /tmp/roomgoblin-main-update.sh --plan
sudo bash /tmp/roomgoblin-main-update.sh
```

Review the downloaded script before execution. It checks the recognized origin,
clean source and fast-forward ancestry. When the installed runner lacks the main
capability marker, it downloads/verifies both exact images, extracts only the
selected commit's runner to a private temporary file, and invokes its journaled
full reconciliation. This is not an unguarded source pull or a local image build.
The runner owns the mutation lock, backup, source switch, health and rollback;
the installer refreshes the installed runner for later efficient updates. Pending
journals are never overwritten. Resume an interrupted transaction before retrying.
Runtime `.env`, data, secrets, ADB/signing identities and managed add-ons remain
protected. Use the normal in-checkout command after this first successful update.

## Pull-request settings

Repository Settings may expose multiple merge methods, but the effective `main`
ruleset is authoritative. The current ruleset permits squash merges only and
requires an up-to-date branch, the `validate` and `windows-agent` checks, and resolved
review threads. Also retain the complete Validate, Display browser regression and
Security gates workflow requirements. Repository checkboxes do not override the
ruleset. Do not bypass checks or enable auto-merge without explicit operator
approval; any change to the ruleset requires a separately reviewed decision.

System Updates quotas charge only requests accepted by the shared administrator
authorization predicate. Rate middleware stays before the administrator guard for
security analysis, but skips rejected callers rather than consuming another
administrator's polling/mutation budget. Forwarded/client addresses do not create
independent update budgets.

## Recovery and limits

Runtime updates retain an operational database/data backup and immutable previous
image IDs. Failures restore source, the saved environment, previous images and
matching database/data backup, then verify health. Recovery tags are separate
from release/SHA aliases. Interrupted deployments roll back from their pending
journal when the native service resumes; they do not replay a partial migration.
The runner executes a private copy so an installer cannot overwrite its active
shell program. A failed rollback retains its journal for diagnosis.

Status remains in `/var/lib/classroom-hub/app-update-status.json` and recovery is
owned by `classroom-hub-app-update.service`. After a terminated transaction, the
Host Agent resumes a still-present durable request journal automatically; a manual
service start is meaningful only when that request file exists. Do not start the
oneshot with no request and do not delete a pending journal to force another
mutation. The web updater accepts only the exact latest merged commit resolved from
the trusted `main` branch, then re-validates it through the native `published`
path. Arbitrary user-supplied commits remain prohibited. Rollback uses the same
verified previous images and matching recovery backup.

The operational ZIP restore format currently targets the canonical
`/app/data/classroom-control-hub.db`. Selective transactions reject another active
database path; use the full installer and its per-database SQLite snapshots for
those deployments. Full Recovery exports retain their separate complete encrypted
identity/transaction guarantees. Selective updates never replace managed add-ons
or copy individual files into live containers. Physical classroom acceptance and
live appliance upgrades must still be checked after deployment.

## Registry failures

Manifest probes are quiet and bounded. Known failed CI stops promptly; unavailable
GitHub metadata never authorizes an image. The publication budget defaults to
20 minutes (`CLASSROOM_HUB_IMAGE_WAIT_ATTEMPTS`, 1–180 ten-second units), each
manifest probe is limited to 20 seconds and each image download to 15 minutes.
A failure before source/runtime mutation leaves running services unchanged.


## Automatic backup retention

Before a runtime-changing application or Ubuntu host update, RoomGoblin creates
an operational `pre-*.zip` safety backup. After health verification succeeds,
the update runner retains the newest 3 automatic operational archives and 1 `pre-*` safety archive and prunes
older automatic ones. A backup pinned for application revert is preserved even
when older than that window.

This cleanup never targets user-created backups or encrypted Full Recovery
`.rgbak` archives. Cleanup failure is a warning only after the new runtime has
already passed health verification.

Diagnostic support bundles are temporary download artifacts and are deleted
after transfer rather than being retained with recovery backups.


### Migration snapshots

Full reconciliation creates `migration-*` rollback snapshots under the host
backup root. After a successful, version-converged install, RoomGoblin now keeps
the newest 3 migration snapshots through the authenticated Host Agent retention
operation. Failed installs do not trigger this cleanup.


### Fixed automatic retention limits

Successful maintenance now automatically retains only:

- 3 automatic operational ZIP backups;
- 1 `pre-*` safety backup;
- 3 `migration-*` installer snapshots.

New automatic operational archives use `auto-operational-*`; manually created
operational exports use `manual-operational-*`. Historical
`classroom-hub-operational-*` files are treated as legacy automatic backups and
participate in the three-backup limit. Full Recovery `.rgbak` files are never
auto-pruned.


### Retention path consistency

Full reconciliation applies ZIP and migration retention after successful
component convergence. Host-side migration and legacy archive cleanup use the
configured `HOST_BACKUP_DIR` (default `/opt/classroom-hub-backups`) rather
than the obsolete historical backup path.

## Host Agent restart during an active update

Restarting the Host Agent during a CLI update is expected. Startup recovery
checks the same appliance mutation lock before asking systemd to resume a pending
journal. If the original transaction owns the lock, it continues uninterrupted.
The native runner also treats a no-argument recovery start with a busy lock, or
with a journal already removed by a completed transaction, as a successful no-op.
It leaves the journal and application status untouched. Explicit new updates
still fail closed on a busy lock or an existing journal.

An orphaned journal with no lock owner still starts the existing rollback/recovery
path. No lock, backup, image verification, or rollback checks are bypassed. After
installing this fix, a stale unit failure from an earlier lock conflict can be
cleared with `systemctl reset-failed classroom-hub-app-update.service` only after
confirming the application update completed and no request journal remains. Do
not start an old updater or delete its journal just to clear a status indicator.

## Manual reinstalls

On existing appliances, `install.sh` enters the native updater with full
reconciliation before changing state. The verified deployment identity must
match; source pulled ahead of deployment, pending journals and incomplete
installations fail closed. Only the native updater may enter the underlying
installer with its inherited mutation lock and complete private safety snapshot.
The same restart rollback protects reinstalls and normal updates. Fresh
bootstrap and isolated local builds remain supported; local builds do not
reinstall existing appliances. Read `INSTALL.md` and
`docs/PRODUCTION-UPDATES.md` before attempting recovery.

## Planning import after upgrade (Unreleased)

The first Hub startup automatically imports existing schedule/profile/calendar data
into a Planning draft, after SQLite/legacy-file reconciliation. One transaction
saves the original snapshot, converted profile and completion marker. Subsequent
starts preserve operator edits. Class/automation IDs, targets and runtime scheduler
state remain intact; the new resolver is not enabled by import. Invalid or failed
imports retain existing scheduling and report status in Planning. The native
updater backup/rollback contract is unchanged. See [Planning automatic import](Planning#automatic-import-on-upgrade).
