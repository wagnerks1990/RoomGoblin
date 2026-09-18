# AI and Contributor Operating Contract

## Displays & AV restoration

The operator retired room topology. Use the original TV Routing Matrix, TV/source
drawers, receiver Setup and Settings display editor. Read
`docs/TV-ROUTING-MATRIX.md` and `docs/ai/ROOM-TOPOLOGY.md`. Preserve existing receiver
and AV-label stores; leave `room.topology` archived and untouched. Do not restore
topology scripts, request wrappers or preference projections. Keep unchanged
matrix controls stable across polling and surface save failures.
Receiver tools/group saves must require a unique enabled output mapping, never a
guessed `tvN`. Preserve long group keys and references; wrap them for readability
instead of automatically stripping historical `display-` prefixes.


For alpha.84 live-upgrade fixes, read `docs/ALPHA82-UPGRADE-RECOVERY.md`.
Keep SQLite database/WAL/SHM access shared with maintenance (0660), ADB trust
group-readable (0750 directory/0640 keys), and legacy signing keys unchanged.

## RoomGoblin identity and rebrand contract

The current product is **RoomGoblin — Classroom & Lab Management Hub**. The canonical tagline is **Run the room. Manage the lab.** Read `docs/brand/AI-BRAND-CONTEXT.md` and `docs/ROOMGOBLIN-REBRAND.md` before changing product naming, logos, colors, setup copy, installer copy, managed-device presentation, or documentation.

New user-facing copy must say **RoomGoblin**. Do **not** perform blind source-wide renames of legacy compatibility identifiers. Alpha.77 deliberately migrates Android from `org.classroomhub.display` to `org.roomgoblin.display`; this requires uninstalling the old app and installing the new app rather than an in-place update. Appliance paths, environment variables, service/socket/container names, persisted storage keys, API contracts, device IDs, enrollment credentials, and ADB trust material remain protected compatibility identifiers unless a separately reviewed migration supplies rollback and data-preservation tests.

## Host-network deployment contract

The Linux RoomGoblin appliance and maintenance containers, plus reviewed managed add-on templates, use host networking. Maintenance is loopback-only; custom ports are actual listeners. Preserve explicit bind addresses, persistent mounts and secrets, and never silently recreate adopted containers. See [Host networking and migration](docs/HOST-NETWORKING.md) for preflight, port inventory, compatibility, acceptance tests and rollback. Do not reintroduce Docker service DNS or port-publishing assumptions.

This file is the authoritative project context for AI coding assistants and human contributors working on RoomGoblin.

## Source of truth

Use the repository on `main` as the source of truth. Read this file before changing application behavior. Then consult, in order:

1. `VERSION` and `CHANGELOG.md`
2. `README.md`
3. `docs/AI-CONTEXT.md`
4. `docs/brand/AI-BRAND-CONTEXT.md`
5. the relevant document under `docs/`
6. implementation source
7. `wiki/` as the Git-tracked mirror of the GitHub Wiki

Do not infer production configuration from public defaults. Site-specific configuration belongs in runtime `.env`, persistent data, mounted secrets, or encrypted application storage.

## Current baseline

The current review baseline is `1.0.0-alpha.84`.

Verified live-test/recovery behaviors inherited by this baseline include:

- direct HTTP appliance mode with Caddy/TLS intentionally deferred;
- SQLite database path reconciliation after alpha.70 left competing database filenames;
- SQLite-safe pre-migration backups for every database file;
- startup repair of incomplete built-in access profiles, including Administrator `capabilities:["*"]`;
- punctuation-heavy local passwords preserved through JSON/scrypt login paths;
- maintenance-token, master-key, Host Agent, data-root ownership, scheduler and database readiness recovery;
- maintenance startup health that checks the Host Agent directly instead of waiting on the main application;
- appliance-wide Docker discovery and lifecycle control for existing containers;
- optional managed Docker integrations for Mosquitto, Govee2MQTT, Music Assistant and Node-RED with adopt-without-recreate and managed deploy/recreate paths; native Veyon services remain host-managed;
- setup receiver IDs remain editable and display groups are pruned when receivers are removed;
- Ant Media Morning Announcements live detection through HLS;
- local HLS playback with working announcement volume/mute control;
- Morning Announcements highest-priority display/audio lock;
- post-announcement failsafe scheduler resync;
- Background Music recovery after priority audio;
- class timer continuation rules and display/client version convergence;
- compatibility-safe RoomGoblin presentation defaults while legacy deployment/device identifiers remain stable.
- passphrase-encrypted/authenticated single-export full recovery with host-owned
  staging, complete safety snapshots, durable journal recovery and all-state
  rollback.
- Full Recovery Export is one cooperative point-in-time transaction: acquire the
  Host Agent appliance lock and one-use Hub writer freeze before database
  selection, drain active writers, snapshot/revalidate identity files, and thaw
  on every outcome. Do not regress to independently walking live roots.

When a later `VERSION` exists, it supersedes this baseline, but these behavioral invariants must remain covered unless a release deliberately changes them.

## Standard production layout

The standard production checkout is:

```text
/opt/classroom-hub
```

The native host agent is:

```text
classroom-hub-host-agent.service
/run/classroom-control-hub/host-agent.sock
```

Docker services/containers are:

```text
service: classroom-hub       container: classroom-control-hub
service: maintenance-agent   container: classroom-control-hub-maintenance
```

These identifiers are intentionally legacy-compatible internals, not the current product name.

Optional RoomGoblin-managed add-ons include:

```text
mosquitto                 eclipse-mosquitto:2.0.22
govee2mqtt                ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72
music-assistant-server     ghcr.io/music-assistant/server:2.9.13
```

Native Veyon services remain host-managed. Existing Docker containers may be discovered and adopted for safe lifecycle/diagnostic control. Creation of new containers remains restricted to these pinned reviewed integration images; do not turn the Host Agent into an arbitrary root Docker command API.

Persistent/runtime data must survive source updates. Never replace or commit production `.env`, databases, data, uploads, backups, master keys, private keys, credentials, or site-specific secrets.

Supported installers and update runners must not edit tracked files or change tracked executable bits inside the production checkout. Install executable copies into `/usr/local/libexec`; a completed install must leave `git status --short` empty when the checkout was clean beforehand.

## Upgrade model

During active development, `main` is the sole integration and update branch.
Use short-lived branches and checked pull requests into `main`; do not add
production/staging/development promotion branches or GitHub environment approvals.
The historical update script name is retained for compatibility. Normal flow:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

For development rebuilds after host state is established:

```bash
docker compose build --no-cache
docker compose up -d --remove-orphans
docker compose ps
curl -fsS http://localhost:3000/health
```

Take a filesystem/database-safe backup before production upgrades.

The GUI updater accepts only semantic-version GitHub releases and delegates the durable update to `classroom-hub-app-update.service`. Preserve its invariant: every update has a matching operational backup, version-aware health check, and automatic source/database rollback. Automatic updates remain opt-in and bounded by the database-backed maintenance window.

Core service recreation is also part of the updater contract. A release can change mounts, read-only/writable paths, environment, or networking without changing an image ID. The updater must therefore force-recreate `maintenance-agent` and `classroom-hub` when deployment inputs/configuration change or when rolling back a release. Published-source selective updates may retain unchanged components only after per-running-image source comparison and a verified deployment-configuration hash; unknown inputs/history must trigger full reconciliation. Read `docs/PRODUCTION-UPDATES.md`. In particular, Managed Displays depends on the dedicated `classroom-control-hub-android-adb` volume mounted at `/managed/classroom-hub/data/android-tv/.android`; the updater must verify this path is writable before declaring the release healthy. Do not replace the force-recreate deployment with a plain `docker compose up -d` unless equivalent tested mount reconciliation exists. See `docs/MANAGED-DISPLAYS-RECOVERY.md`.

## Database identity and recovery

`DATABASE_FILE` is authoritative. Installer/update logic must never silently select another SQLite filename merely because it exists. Before a migration, back up every `data/*.db` with SQLite's `.backup` API. If database filenames are reconciled, stop the application first, verify the destination with `PRAGMA quick_check`, preserve the previous file for rollback, and update `.env` before recreating the container.

The maintenance backup/restore implementation and application runtime must agree on the canonical active database. A release that can start against a stale alternate database is not acceptable.

### Full Recovery transaction

Alpha.80 Full Recovery exports exactly one `.rgbak` envelope. It uses
AES-256-GCM and scrypt (`N=32768`, `r=8`, `p=1`) with a random 16-byte salt and
12-byte nonce; the canonical bounded header is authenticated additional data.
Passphrases are 16 characters minimum and 1024 UTF-8 bytes maximum and must
never be persisted or logged. Buffered recovery payloads default to 256 MiB and
have an absolute 512 MiB limit.

Never accept a recovery passphrase from a remote direct-HTTP browser. Use
loopback or HTTPS terminated by a same-host loopback reverse proxy. Normal trusted-LAN HTTP support does not
weaken this passphrase-transport boundary.

Maintenance stages only authenticated, allowlisted content beneath
`/host-backups/recovery-staging`; the corresponding host root is
`${HOST_BACKUP_DIR}/recovery-staging`. The Host Agent serializes recovery and
updates with `/run/classroom-control-hub-appliance-mutation.lock` and journals
full recovery
under `/var/lib/classroom-hub/full-recovery`. Preserve recovery on restart:
unfinished transactions roll back from their complete safety snapshot before a
new mutation can begin. Bundle paths, UID/GID, and modes are evidence only;
fixed host policy owns destinations and permissions.

Commit the active database and master key as one identity, then require
`PRAGMA quick_check`, schema/readiness checks, and decryption of every
`secret_store` row. Treat ADB private/public keys plus the named
`classroom-control-hub-android-adb` volume as one identity, and the Android
signing keystore/password as another indivisible identity. Do not regenerate
either identity and report success. Native Veyon recovery is bounded to the
configured `VEYON_RECOVERY_ROOT=/veyon-recovery` mount.
The zero-byte `private.pem` created for the optional Compose bind is only an
unconfigured placeholder, not a recoverable identity. Native
`/opt/services/veyon-webapi` runtime files are not RoomGoblin-owned Docker state
and remain outside the portable managed-service archive.

On Host Agent restart, bind and serve the authenticated Unix socket before
resolving an interrupted recovery, while rejecting mutations with `423`.
Maintenance health depends on that socket, so core Compose reconciliation must
not run before the socket can answer health requests.

Only a service whose saved `deploymentOwnership` is `roomgoblin` and whose
image matches the fixed reviewed identity may be recreated. Never replace an
adopted/external service; fail closed on an ownership, name, or image collision.
Preserve the saved running/stopped state of owned services.

## Version convergence

A release is not complete until every user-visible/runtime version surface agrees. `VERSION` is the primary release value. The main image stamps controller, display, and Windows-agent runtime surfaces during the build; the maintenance image stamps its embedded runtime diagnostic version from package metadata; the Host Agent wrapper reports the release version while retaining the audited core implementation.

Published production images must carry
`org.opencontainers.image.revision=<exact Git commit>`. Install and web-update
paths compare that label with the selected trusted commit before deployment;
matching version text is not sufficient source identity.

Run repository validation and search for unintended stale current-baseline version strings before release.

## Operator GUI contract

Read `docs/GUI-WORKSPACES.md` before changing operator navigation or layout.
Scope shared workspace styles to `body.rg-workspace`; never load them into the
physical display renderer. Preserve capability-hidden navigation, stable control
IDs/handlers and the single display-layout engine when reorganizing controls.

### Veyon previews and condensed inventories

Veyon page code lives in `public/controller/veyon.{html,css,js}`; bounded image
transport is in `src/veyon-transport.js`. Preserve `lab.sensitive.read` on previews,
backend-only keys/UIDs, per-host authentication single-flight, active-reader pool
protection, bounded frame retries and decode-before-swap. Never infer authenticated
status from TCP reachability or swallowed errors. Read
`docs/VEYON-MUSIC-INTEGRATIONS.md` before changing this contract.

Filtered-out selections remain command targets and must be visibly counted.
Retain all commands, confirmations, modal password clearing and keyboard focus
when redrawing inventory. Focus workspace must not recreate iframe sessions.
Keep the supplied valid192 brand image as the default; legacy400w/512 URLs are
compatibility aliases with actual192 dimensions, not new high-resolution artwork.

## Critical behavior invariants

### Access profiles and authentication

An explicitly assigned profile is an authorization boundary and fails closed when invalid. Built-in profiles must remain complete during migration. In particular, `administrator` must be enabled with `capabilities:["*"]`. Startup recovery may repair a built-in profile whose capability array is missing/empty, but must not overwrite an existing non-empty custom capability list.

Passwords are opaque strings to the application. Characters such as `!`, `#`, `$`, quotes, backslashes and semicolons must survive browser JSON, API handling and scrypt verification. Shell tooling must use quoting/hidden input rather than interpolating credentials into unquoted shell commands.

### Setup wizard displays

Receiver IDs are stable identifiers and remain editable. Reducing the receiver list must remove stale references from every display group before saving. Friendly names may change without changing receiver IDs or invalidating optional display credentials. Stable URL-only access for enabled configured displays is the default and must not be changed to mandatory enrollment without an explicit product decision and migration plan.

### Managed integrations and Docker control

The controller is the appliance control plane. It inventories existing Docker containers and can perform authenticated safe lifecycle/log operations on discovered containers. Supported add-ons can be adopted in place without recreation or explicitly deployed/recreated from reviewed image repositories. Persistent integration data must remain outside container writable layers and must be preserved when an add-on container is removed/recreated.

Do not silently recreate an externally discovered service during adoption. Destructive removal/recreation must remain explicit.

### Automation action loops and media sessions

Per-action looping must never be implemented by restarting an automation occurrence. `display.media` loop mode is receiver-native and preserves the active HTML5 media session. Live volume/seek/pause/rate changes use `display.media.control`; do not reissue `display.media` for control-only changes because replacing the media command restarts playback. Non-media actions may use bounded repeat only. Preserve Morning Announcements priority, Background Music reconciliation, scheduler occurrence identity and display recovery.

### Morning Announcements

Morning Announcements have highest priority whether started manually or automatically. While active, conflicting display automations must not overwrite announcement targets and Background Music must be paused. When announcements end, the scheduler must re-evaluate the current moment and re-trigger the winning currently applicable display automations before Background Music resumes.

Do not restore a stale display snapshot or blindly replay all earlier events.

### Timer

Timer chaining is allowed only for the matching continuation of the same underlying base period/class. Adjacent normal periods never chain solely because they are close in time. Transition pseudo-classes are terminal standalone timers.

### Background Music

Normal visual automations do not disturb Background Music. Unmuted priority video/stream/audio pauses it. It resumes only after priority audio ends and display automation reconciliation has completed. Remote days suppress scheduled Background Music while manual controls remain available.

### Display authentication

Classroom receivers use enabled stable display IDs without credentials by default. This is an intentional trusted-network product choice. Individual enrollment is optional and administrator-controlled; when enabled, store only hashes server-side and return a raw credential only once. Configuration saves and display renames must not invalidate optional credentials; removing a display must remove them.

## Hardware and integrations

Public source must stay generic. Do not hardcode production IPs, stream IDs, credentials, school names, calendars, or tokens into tracked defaults.

Important integrations include MQTT/Govee, Pluto Mark I, Music Assistant, Veyon, Ant Media/HLS, displays, and the native Host Agent. Health of one integration must not falsely mark unrelated integrations offline. Slow or optional probes must not block initial Overview rendering.

School and classroom identity and theming are stored in the SQLite site profile and exposed to browser surfaces only through presentation-safe responses. This project is intentionally education-only. Keep the Kyle Wagner attribution present on all current user-facing pages.

## CI workflow identity contract

The consolidated required workflows are `Validate`, `Display browser regression`, and `Security gates`. Android debug and restrictive-image coverage now live inside Validate; see `docs/CI-WORKFLOWS.md`. Workflow `name:` values are consumed by both `.github/workflows/publish-main-images.yml`
and `.github/workflows/docker-publish.yml`. `Display browser regression` also runs
operator GUI tests; describe coverage in job/step names without renaming this gate.
Keep `test/production-image-install.test.js` workflow-identity coverage passing.
A merged source commit is not installable until its exact Hub and maintenance images
are published; never recommend retagging another commit or bypassing validation.
Bootstrap and source updates select `main`, but only its exact published image
pair may be deployed. No workflow creates or advances a deployment branch.
Preserve selective reconciliation, the legacy-runner migration, main ancestry,
image verification, backups and rollback. Keep local branches/commits intact;
legacy production and detached recovery checkouts transition safely to main.
See `docs/PRODUCTION-UPDATES.md`; never replace this with an unconditional pull.
Repository settings and the main PR ruleset must both permit merge, squash and
rebase methods. Preserve required checks and resolved reviews, and never bypass
protections or claim an administrative setting changed without verifying it.

## Testing before commit/release

At minimum run the validations represented by `.github/workflows/validate.yml`:

```bash
node --check src/server.js
node --check src/storage.js
node --check src/startup-recovery.js
node --check maintenance-agent/server.js
node --check maintenance-agent/extensions.js
node tools/validate-controller.js
python -m py_compile host-agent/server.py host-agent/start.py
docker compose config
docker build -t classroom-control-hub:test .
docker build -t classroom-control-hub-maintenance:test maintenance-agent
npm test
```

The independent `Security gates` workflow scans full Git history for secrets
and reviews pull-request dependency changes at moderate severity or higher.
The main validation also blocks on high/critical fixable vulnerabilities in
both built runtime images. Release and validated-main image publication must
wait for these gates. Keep third-party actions pinned to reviewed full commit
SHAs. Dependabot covers both Node dependency graphs, GitHub Actions, and the
Android Agent Gradle graph.

For behavior changes, add targeted regression checks and document what was actually verified. Never claim production testing that was not performed.

## Documentation contract

Changes that alter architecture, configuration, installation, operations, recovery, APIs, branding, or user-visible behavior must update the corresponding file in `docs/` and, when relevant, the matching page in `wiki/`.

`wiki/` is the repository mirror of the GitHub Wiki. Keep it synchronized with the actual Wiki after documentation changes. Branding changes must also update `docs/brand/AI-BRAND-CONTEXT.md` when they change how future assistants should work.

## Security

Never commit or reproduce live secrets. Keep `.env`, private keys, database files, backups, and secret material out of Git. HTTP-only alpha deployments must be restricted to a trusted classroom/admin LAN until TLS is deliberately reintroduced and tested.

### Maintenance mutation boundary

Authenticated maintenance mutations share an appliance-wide limit of 30 requests per 60 seconds, enforced after token authentication and before both legacy and extension-wrapped routes. Excess writes return HTTP 429 with a Retry-After header; GET/HEAD/OPTIONS polling and health checks do not consume this budget. Forwarding headers cannot create new budgets. The counter is in memory and resets on a maintenance process restart.

## Host installer group prerequisite

Resolve host GID 10001 before backup/data/secret mutation. The group inside the image is not a host group record. Source `deploy/host-group.sh`, reuse an existing GID or create `classroom-hub` only when its name and ID are free, and pass the verified name to install. Fail closed on conflicts/lookup errors; never renumber existing groups, add host users to this secret-readable group, or regenerate keys for this error. Keep `test/installer-host-group.test.js` coverage and `docs/HOST-NETWORKING.md` recovery instructions synchronized.

### Sendspin transport ownership

The backend's dedicated Sendspin relay is in `src/music-assistant-sendspin.js`. It uses the configured audio port (normally 8927), not the API/web-player socket on 8095; the API token never enters raw audio frames. Keep the browser on the existing ticketed same-Hub proxy and preserve the single display-layout engine. Do not reintroduce PR #22's patch scripts or direct-browser/auto-fit experiments. See [Sendspin architecture and selective review](docs/MUSIC-ASSISTANT-SENDSPIN.md).

Keep each active display host on its own receiver ID. Preserve bounded relay
close diagnostics and browser `lastProxyClose`; never log proxy ticket URLs or
raw peer reasons. Stale close callbacks may log but cannot mutate successor
sessions. A browser autoplay warning followed by `ctx=running` is recovered
context state, not evidence that the transport is failing. Read
`docs/ai/BROWSER-DISPLAY-AUDIO-CONTEXT.md` before changing this lifecycle.
Unattended desktop Chrome/Edge requires administrator-managed autoplay policy;
JavaScript must not pretend to manufacture user activation. Keep policy examples
generic and origin-scoped; never commit a production appliance address.

### Managed Android trust boundaries

The exported Android configuration receiver is an ADB bootstrap surface, not a general inter-app API. Keep it guarded by the platform `android.permission.DUMP` permission so `adb shell am broadcast` remains compatible while ordinary apps cannot replace the display URL, Device Agent token, persistent-ADB policy, or root-tools policy.

Treat the staged APK and its JSON metadata as mutable application data. Before every install or artifact-ready response, verify the APK signature and compare its certificate digest with the protected keystore identity under `/signing/android-agent`; metadata alone is never signing authority. Preserve the one-time complete-pair migration from the older direct `/signing` layout.

Wireless ADB endpoint recovery must bind a changed mDNS address to the saved per-device Android ID. A firmware/build fingerprint is shared by devices of the same model and must never authorize reassignment. Device Agent HTTP work must remain bounded by fixed worker, queue, header, body, and socket-timeout limits.

## Fixed product identity

Product name, descriptor, tagline, logo and favicon always use the supplied
RoomGoblin identity. Settings and Setup must not expose custom product-name or
asset-URL controls. Preserve school/room labels, device names, display prefixes,
timezones and theme settings. Old identity overrides are ignored on reads and
canonicalized on normal saves; do not delete uploads or migrate compatibility
identifiers. See `docs/ROOMGOBLIN-REBRAND.md` for the current contract.

## Embedded lab viewport and preview diagnostics

The controller owns normal scrolling for same-origin Veyon/Windows frames through
`embedded-workspaces.js`. Preserve frame nodes/sessions and the published child
viewport when changing layout; a content-height iframe must not poll every screen.
Modal bounds use the visible parent viewport. Standalone lab pages remain usable.
Veyon root reachability (including HTTP 404) is not authentication or screen proof.
Preserve bounded PNG fallback and sanitized failure stage/code responses; do not
expose raw upstream text, keys or UIDs in preview errors.

## Veyon command recovery

Use the server-owned bounded command queue for classroom feature commands.
Preserve per-host ordering, request-ID deduplication, dispatch-time authorization,
latest lock intent and read-back confirmation. One-shot commands with uncertain
outcomes must not be blindly replayed. Only reversible RoomGoblin-owned lock/broadcast mode
metadata belongs in the SQLite journal; never persist login arguments or UIDs.
Fresh Hub startup clears owned locks and broadcast modes instead of restoring
stale classroom intent.
Queue workers must participate in Full Recovery Export pause/drain accounting.
Do not report unavailable feature state as false or broadcast-stop failures as
success. See `docs/VEYON-MUSIC-INTEGRATIONS.md` for recovery semantics.

## Native ESPHome boundary

ESPHome device management uses `src/esphome.js` and the private stdin/stdout
`src/esphome/worker.py` worker with the pinned official `aioesphomeapi` client.
Read `docs/ESPHOME-INTEGRATION.md` (or `ESPHOME-INTEGRATION.md` from docs).
Preserve mandatory native encryption, private literal IPv4 targets, verified MAC
identity, composite subdevice/entity IDs, secret-store transactions, capability
checks and Full Recovery Export writer drain. Unknown/disabled entities are not
arbitrary native methods. Buttons/configuration controls require administrator
confirmation. Commands are never replayed after uncertain delivery, disconnect or
restart. Sensor state/reconnects are memory-only. Firmware, HA actions, automatic
mDNS enrollment and sensor-triggered automations are not implemented by this module.
Do not broaden this boundary or replace native encryption with unauthenticated
HTTP, an exposed worker port, arbitrary service calls, or privileged Docker access.

## Receiver editor recovery

The receiver editor lives in the collapsed `receiverSettings` form under Displays
& AV, linked from Settings and the TV drawer. Keep its `RECEIVERCFG` draft separate
from poll-refreshed `S.avConfig`. Preserve drafts when editing/removing groups.
Do not infer receiver IDs from output numbers or choose the first of several
receivers sharing an output. Receiver tools require a unique saved assignment;
physical matrix routing and power remain independent. Cleanup of empty repeated
`display-` groups is explicit and limited to the draft until saved; never rewrite
schedule references or delete nonempty/custom groups automatically. Follow
`docs/TV-ROUTING-MATRIX.md` for recovery and validation details.

## Free Veyon features and native pilot

Read [docs/VEYON-FREE-FEATURES.md](docs/VEYON-FREE-FEATURES.md) and `integrations/veyon-plugins/PROVENANCE.md` before changing free-feature coverage. Keep `src/veyon-free-features.js` and the companion controller script bounded; API advertisement is not endpoint verification. The community file adapter is a narrow one-target pilot, not stock WebAPI or official bulk transfer. Never return successful arbitrary internal commands. MAC identity must fail closed after hostname changes. Cleanup queue admission must reserve all modes before changing intent. Browser recording uses sensitive-read frames with hard time/memory bounds and stops on capture failure/hide. Native GPL community sources are isolated from the MIT Hub, built only against pinned matching upstream in disposable pilots; no installer, production key change, commercial add-on bypass or unvalidated Windows ABI claim. Internet Guard is Windows-only source until a matching 4.11.2 Windows build and disposable-endpoint acceptance are complete. Preserve the Linux pilot build gate and operator tests.

## Native pilot artifacts

The Validate native job builds the entire pinned Linux Veyon tree and publishes
matching binaries plus all corresponding source. See docs/VEYON-PILOT-BINARIES.md.
`tools/package-veyon-pilot.sh` uses DESTDIR staging and verifies both community
plugins with the installed CLI. Preserve numeric root archive ownership and the
archive path/link/privileged-metadata policy gate. No production install, service start, key export
or Windows compatibility claim is allowed. Preserve GPL source distribution and
require disposable matching Ubuntu desktop VMs for interactive acceptance.

Veyon installed-version reporting must use host package inventory, independently
of pending apt upgrades. Never infer endpoint features from a fixed 4.9.7
baseline. See docs/VEYON-LIFECYCLE.md for evidence and browser-adapter boundaries.

Browser clipboard writes use the existing transient command queue and require
exact RoomGoblinWebBridge advertisement. Read docs/VEYON-WEB-CLIPBOARD.md before
changing that path. No clipboard payload in logs/journal/job projections, no
uncertain replay, no arbitrary protocol forwarding, no inferred endpoint success.

The operator already has Veyon Master. Do not add native launcher buttons,
download scripts or native-only entries to the web feature catalog. Keep such
capabilities and community candidates in documentation. Features with actual
browser adapters may state their required native bridge explicitly.

Read docs/VEYON-COMMUNITY-WEB.md before changing browser sessions. Preserve owner/computer/native-connection binding, native expiry, request correlation, bounded buffers, no uncertain replay and asynchronous export drain. File uploads are one target, 2 MiB maximum, ordered 128 KiB chunks, Inbox-only, atomic and no-overwrite. These are matching native pilot adapters, not stock WebAPI capabilities.

Read docs/VEYON-BROWSER-CONTROL.md before changing remote input. Preserve live
frame/topology/revision leases, monotonic sequences, native event/queue bounds,
forced key/button release and sent/unverified wording. Clipboard reads are
explicit correlated endpoint requests, never VNC-event cache reads or polling.
Keep official file distribution/collection native-only until an adapter has
bounded paths/storage and honest endpoint acknowledgement semantics.

Local AI pilot: docs/VEYON-LOCAL-AI.md and integrations/veyon-ai/PROVENANCE.md. Keep the AGPL service separate, exact model hash, fixed loopback endpoint, separate token, explicit single-screen capture, no retention/enforcement, bounded concurrency and export drain. Do not claim the full upstream AI dashboard or verified classroom accuracy.
