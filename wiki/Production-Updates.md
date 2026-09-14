# Published production updates

`main` is the development source of truth. **Publish Main Images** advances
`production` only after all required checks and both image publications succeed.
Never point that branch at unbuilt source or retag another revision to satisfy it.

## Normal update

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh --plan
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The optional plan fetches published source and reports component decisions without
changing the checkout or services. Normal updates use the native runner's
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
its current commit can fast-forward to published source; the updater does not
reset or overwrite a branch to repair it.

## First transition

An existing published-source updater runs its previous full installer once when
installing this implementation. That establishes the component tags, deployment
record and installed native runner. Later normal updates can use selective mode.
If source was manually advanced without installing the matching runner, run the
full `sudo bash /opt/classroom-hub/install.sh` once before using selective mode.
Do not use forced resets, substitute image tags, or local development builds to
work around failed publication.

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
