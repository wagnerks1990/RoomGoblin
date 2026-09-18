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

## Normal update

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

Both repository Settings > General > Pull Requests and the main ruleset must allow
merge commits, squash merges and rebase merges. The default branch is main; keep
pull requests, required checks, resolved review threads and branch protections.
Auto-merge is useful only after all required checks/reviews complete. Do not bypass
checks, add long-lived environment branches or disable security scans to save time.
Squash is convenient for small fixes; all three methods are permitted by policy.
An administrator must apply any outstanding ruleset setting; documentation or the
repository checkboxes do not change a restrictive ruleset by themselves.

## Recovery and limits

Runtime updates retain an operational database/data backup and immutable previous
image IDs. Failures restore source, the saved environment, previous images and
matching database/data backup, then verify health. Recovery tags are separate
from release/SHA aliases. Interrupted deployments roll back from their pending
journal when the native service resumes; they do not replay a partial migration.
The runner executes a private copy so an installer cannot overwrite its active
shell program. A failed rollback retains its journal for diagnosis.

Status remains in `/var/lib/classroom-hub/app-update-status.json` and recovery is
owned by `classroom-hub-app-update.service`. After a terminated CLI session, use
`sudo systemctl start classroom-hub-app-update.service` to resume its pending
journal. Do not delete the journal to force another mutation. The existing web
release/revert controls share this runner; they still accept semantic releases
only and reconcile both containers. They do not accept arbitrary commit requests.

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
