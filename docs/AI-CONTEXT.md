# AI Project Context

## Managed Cloudflare remote HTTPS

RoomGoblin has an optional first-class Cloudflare provisioning path. Site-specific domains and Cloudflare resource IDs remain runtime database values; API credentials are encrypted secrets. The connector token is host secret state at `/etc/cloudflared/roomgoblin.token`. Provisioning may manage a remotely managed Tunnel, proxied DNS, Always Use HTTPS, Automatic HTTPS Rewrites, HTTP/3, Brotli, and optional Access. Existing same-name tunnels and conflicting DNS records are fail-closed unless explicit adoption/replacement is selected.

The tunnel exposes only the Hub through same-host loopback and uses `TRUST_PROXY_HOPS=1`; Cloudflare is never allowed to publish maintenance 3010, Host Agent, Docker, SSH, Veyon, MQTT, Music Assistant, or lab subnets. Cloudflare failure affects remote access only and must not gate Morning Announcements, scheduler recovery, Background Music reconciliation, managed displays/devices, local administration, updates, or recovery. Read `docs/ai/CLOUDFLARE-TUNNEL.md` before changing this feature.

## Runtime click-through regression guard

Controller-owned display test cards are served only from `/test-images/tv1.svg` through `/test-images/tv8.svg`. Media-command URL validation must allow those exact built-in assets while continuing to reject arbitrary same-origin paths, credentialed URLs, backslashes, and traversal-like inputs. The live 2026-09-18 controller click-through exposed this boundary when **Test Image** generated HTTP 400 despite the asset being shipped by RoomGoblin. Keep `test/full-project-audit-regressions.test.js` aligned with this allowlist.

## Displays & AV restoration

The operator retired room topology. Use the original TV Routing Matrix, TV/source
drawers, receiver Setup and Settings display editor. Read
`docs/TV-ROUTING-MATRIX.md` and `docs/ai/ROOM-TOPOLOGY.md`. Preserve existing receiver
and AV-label stores; leave `room.topology` archived and untouched. Do not restore
topology scripts, request wrappers or preference projections. Keep unchanged
matrix controls stable across polling and surface save failures.


Alpha.82 live-upgrade corrections and acceptance limits are documented in
`ALPHA82-UPGRADE-RECOVERY.md`. Preserve shared SQLite/ADB access under GID 10001
and the pre-rebrand Android signing identity during every install and restore.

## Docker network deployment contract

RoomGoblin uses least-privilege networking per service. The core Hub and maintenance containers retain their reviewed host-network contract; host networking is not the default for add-ons. Music Assistant and Govee2MQTT remain host-networked because their upstream LAN discovery/control protocols require it. Mosquitto uses the user-defined `roomgoblin-integrations` bridge with a loopback-only published MQTT listener. Managed Music Assistant also carries a bounded `/data/.roomgoblin-compat/wait-for-lan.sh` startup gate: it waits up to 60 seconds for the LAN-filtered adapter set to expose a usable IPv4 before execing `/usr/local/bin/entrypoint.sh --data-dir /data --cache-dir /data/.cache`. This prevents the observed early-boot `ip_addresses[0]` `IndexError` without hard-coding a site IP or weakening Docker restart behavior. Preserve explicit bind addresses, persistent mounts and secrets, never silently recreate adopted containers, and let Docker manage bridge/veth/firewall implementation state. See [Docker networking and migration](HOST-NETWORKING.md) for topology, migration, validation and rollback.

This document gives AI assistants a compact operational model of RoomGoblin. `AGENTS.md` is the primary contributor contract; this document expands the technical context.

## Purpose

RoomGoblin is a centralized classroom/lab control platform. It coordinates browser displays, scheduled automations, AV routing, lighting, Morning Announcements, Background Music, class schedules, school-cycle rules, Veyon lab management, diagnostics, backup/recovery, Docker integrations, Android/Google TV managed displays, and host-management functions.

Production installers and semantic-release updates pull exact CI-built GHCR
images. Do not reintroduce appliance-local builds as the default. Local compilation
is available only through the explicit `install.sh --build-local` development path.

CI treats secret scanning, pull-request dependency review, and high/critical
fixable vulnerability scans of both built runtime images as release gates. All
third-party actions must remain pinned to full reviewed commit SHAs, and
Dependabot covers npm, GitHub Actions, and the Android Agent Gradle build. The
tracked integration catalog is documentation/discovery metadata; its managed
image set must stay aligned with the executable maintenance/Host Agent allowlist.

## Operator workspaces

The GUI uses grouped navigation and native expandable sections to separate daily
controls from configuration and maintenance. See [Operator workspaces](GUI-WORKSPACES.md)
for styling ownership, responsive behavior and review requirements.
`public/controller/workspace.js` changes navigation presentation only; existing
page activation and authorization remain in `app.js`. Shared operator CSS is
opt-in and must not enter physical display, document or video playback layouts.

Veyon UI code is split into HTML/CSS/JS and uses bounded visible-preview workers,
decode-before-swap and labeled stale/error states. Backend transport is in
`src/veyon-transport.js`; session retries must preserve sensitive-read permissions,
backend-only keys and UID-specific cleanup. See the Veyon integration contract.
Desktop focus mode changes shell layout without reloading embedded tools.
Inventory filters retain hidden selections with explicit counts. Canonical product
marks use the supplied valid192 mascot; old400w/512 URLs are compatibility aliases.

## Optional Securly physical-console kiosk

The appliance may also use its directly attached monitor as an independent Securly Pass kiosk. This is a host-side Xorg/Openbox/Chromium Snap session, not a RoomGoblin container or application-health dependency. The production kiosk URL/code is local secret state under `/etc/roomgoblin/` and must never enter Git, logs, examples, or AI-generated patches. Preserve SSH and a separate sudo-capable maintenance account. The known-good Snap session uses the systemd user D-Bus bus, redirects Chromium away from tty1 file descriptors, uses the Snap-owned browser profile, and currently launches Chromium with `--disable-gpu` while Xorg continues to use the host GPU driver. Read `SECURLY-KIOSK.md` and `ai/SECURLY-KIOSK.md` before changing this path.

## Runtime architecture

```text
Ubuntu host
├── /opt/classroom-hub
├── classroom-hub-host-agent.service
│   └── /run/classroom-control-hub/host-agent.sock
└── Docker Engine
    ├── classroom-control-hub
    └── classroom-control-hub-maintenance
```

The main application must not receive broad host privileges. Host-level operations are delegated through the maintenance service to the native Host Agent over the Unix socket.

### Appliance control plane

The controller is the appliance control plane. It inventories Docker containers already present on the host and may perform authenticated lifecycle/log/inspection operations on discovered containers. New container creation remains restricted to reviewed supported integration image repositories.

First-class optional managed add-ons are:

```text
mosquitto                 eclipse-mosquitto:2.0.22
govee2mqtt                ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72
music-assistant-server     ghcr.io/music-assistant/server:2.9.13
```

Setup and Infrastructure & Recovery expose these services. Existing containers should be **adopted without recreation** unless the administrator explicitly chooses deploy/recreate. Managed persistent data must live beneath the services root rather than container writable layers and should survive container removal/recreation.

The Host Agent extension may dynamically allow safe lifecycle/read operations for an existing discovered container, but `docker run` remains image-allowlisted. Do not replace this with an arbitrary root Docker command surface.

### Current network exposure

The appliance is intentionally **HTTP-only for ordinary administration in the current development/live-test phase**. The main application publishes port `3000` directly, with `HUB_BIND_ADDRESS=0.0.0.0` by default so trusted classroom/admin LAN clients can reach it. Caddy and the built-in HTTPS/TLS gateway were removed after alpha.70 deployment failures and will be redesigned later.

Do not assume an HTTPS reverse proxy exists. Do not add Caddy/TLS dependencies, certificate checks, `HUB_TLS_HOST`, `HUB_HTTP_PORT`, or `HUB_HTTPS_PORT` back into deployment/update health gates unless HTTPS is being deliberately reintroduced as a separate reviewed feature. With no reverse proxy, `TRUST_PROXY_HOPS` defaults to `0`.

HTTP is a temporary trusted-network deployment mode. Avoid exposing the appliance directly to untrusted networks or the public Internet. Windows lab-agent HTTP enrollment keeps an explicit `-AllowHttp` acknowledgement until TLS returns.

Full Recovery passphrases are a stricter boundary: the browser may transmit one
only through loopback or HTTPS terminated by a same-host loopback reverse proxy. A trusted LAN does not
make remote plaintext HTTP acceptable for `.rgbak` export/import.
An HTTPS proxy deployment must set the exact `TRUST_PROXY_HOPS` value and block
direct client access to the backend; forwarded transport headers are not a
security boundary when port 3000 remains directly reachable.

## Media-plane production invariant

Uploaded video/audio payload delivery is split from the controller/control plane. Port `3000` owns the controller, REST API, scheduler, display WebSockets, telemetry and media-session commands. Port `3020` owns authorized `GET/HEAD /media/*` byte-range delivery.

Preserve these rules:

- never move sustained MP4 transfer back onto port `3000` as a convenience fix;
- physical receivers keep signed asset authorization while controller/browser media requests may be authorized through the existing authenticated session;
- `:3020` responses use `Cross-Origin-Resource-Policy: cross-origin` because the receiver page and media listener intentionally use different ports; authorization still happens before bytes are served;
- Today/controller previews must not create live MP4 decoders; show a lightweight video-active placeholder instead;
- Display Studio/media-library cards must not instantiate full MP4 `<video>` elements as thumbnails;
- commanded receiver video starts in an autoplay-safe muted state, then applies the requested audio state after playback starts; if audible autoplay is blocked, continue muted rather than leaving playback stopped;
- live pause/seek/volume/rate/restart controls use the persistent media session and must not reissue the original media command;
- a large socket send queue on `:3020` can be healthy during playback if `:3000` remains responsive.

Alpha.84 received live production acceptance on 2026-09-18: playback, volume and live controls worked; both health endpoints were green; video backpressure appeared on `:3020` while normal control connections remained responsive on `:3000`. Read `docs/MEDIA-PLANE.md` and `docs/ai/MEDIA-PLANE.md` before changing this path.

## Persistent state

Treat these as runtime state, not replaceable source:

- `.env`
- `data/` and the SQLite database
- uploads/media/presentation data
- backups
- private keys and the master encryption key
- managed integration data beneath the services root
- site-specific hardware mappings and credentials
- Android/Google TV managed-device inventory, ADB keys, agent package and policy state beneath `data/android-tv/`

A Git update must preserve them.

The shared `data/` root is intentionally root-owned with group `10001` access so both the non-root application and hardened maintenance container can traverse it. Application-owned files remain UID/GID `10001:10001`; `data/backups` is maintained by the maintenance layer. Do not reintroduce code that chmods the entire shared data root to `0700`.

The current master key path is `/etc/classroom-control-hub/master.key`. Upgrades from older installations must preserve `/etc/classroom-hub/master.key` by migrating it rather than silently generating a replacement.

## Current known-good baseline

`1.0.0-alpha.84` is the current production-readiness review baseline.

Production deployment is currently validated only on `amd64` Ubuntu Server
24.04 LTS. Treat `arm64` as unsupported until both container images and the
Android/ADB build/runtime path are published and validated for that architecture.

Alpha.71 recovery invariants:

- Host Agent, maintenance, backend and stamped client versions converge;
- `MAINTENANCE_TOKEN` must be non-empty before container recreation;
- maintenance Compose health checks the Host Agent directly and does not wait on the main application;
- database and scheduler readiness must pass before an update is accepted;
- installer takes SQLite-safe backups of every `data/*.db` before migration;
- `DATABASE_FILE` is authoritative and must not silently switch to another existing database filename;
- built-in access profiles are repaired when their capability array is missing/empty; Administrator must resolve to `capabilities:["*"]`;
- password strings containing punctuation survive setup/login/scrypt verification;
- setup receiver IDs remain editable and display groups must be pruned to the saved receiver set;
- supported existing integration containers can be adopted without recreation;
- HTTP-only deployment must not regain a TLS-gateway dependency.

Alpha.80 Full Recovery invariants:

- the portable artifact is one AES-256-GCM `.rgbak` envelope using scrypt
  `N=32768/r=8/p=1`, a random 16-byte salt and 12-byte nonce, and an
  authenticated canonical bounded header;
- passphrases are memory-only, 16 characters minimum/1024 UTF-8 bytes maximum,
  and may cross the browser boundary only over loopback or HTTPS terminated by
  a same-host loopback proxy;
- the buffered payload default is 256 MiB and its absolute ceiling is 512 MiB;
- maintenance stages beneath `/host-backups/recovery-staging`; the Host Agent
  owns final paths, modes and IDs, serializes with
  `/run/classroom-control-hub-appliance-mutation.lock`, and journals under
  `/var/lib/classroom-hub/full-recovery`;
- every affected state root has a safety snapshot and any failed/interrupted
  transaction rolls all changed roots back before normal service resumes;
- the active database/master key, ADB private/public keys/named volume, and
  Android signing keystore/password are indivisible identity pairs/sets;
- acceptance requires SQLite integrity/schema/readiness and successful
  decryption of every `secret_store` row, plus application, scheduler, Host
  Agent, maintenance, version, asset and managed-device verification;
- only explicit `deploymentOwnership: roomgoblin` service state with the fixed
  reviewed image identity may be recreated; adopted/external collisions fail
  closed, and an owned service's saved stopped state is preserved;
- native Veyon identity recovery is restricted to the reviewed
  `VEYON_RECOVERY_ROOT=/veyon-recovery` mount.
- export acquires the Host Agent appliance lock and a one-use application writer
  freeze before database selection; it drains in-flight HTTP/WebSocket and
  scheduler/announcement/presentation/session/audio/update work, queues audits,
  and fails closed after 30 seconds rather than mixing points in time;
- master, ADB, signing and native Veyon identities are stable-copied and
  revalidated under that host lock, and both freeze tokens are released on every
  success/failure path (with a bounded crash lease);
- an empty Veyon private-key bind placeholder means Veyon is unconfigured and
  is omitted; native `/opt/services/veyon-webapi` runtime files are not managed
  Docker state and are excluded;
- interrupted rollback serves authenticated Host Agent health before Compose
  reconciliation while rejecting mutation requests;
- pulled production images are accepted only when their OCI revision label
  equals the exact selected Git commit.

Verified classroom behaviors remain:

- HLS is the primary Morning Announcements live/offline signal for Ant Media player URLs.
- A valid HLS playlist is LIVE; a confirmed 404 is OFFLINE; transient network errors are not definitive offline evidence.
- Two consecutive OFFLINE checks are required before automatically ending active Morning Announcements.
- Announcement playback uses a locally controlled media element so volume/mute controls work.
- Morning Announcements are highest priority and pause Background Music.
- When announcements end, the scheduler performs a failsafe resync and re-runs the currently applicable winning display automations before Background Music resumes.
- Timer continuation is limited to an explicitly linked continuation of the same base class or period.

If `VERSION` is newer, use the newer release as the version source while retaining these invariants unless explicitly changed in the changelog.

## Database identity and migrations

Alpha.70 demonstrated that two valid-looking SQLite filenames can cause a successful container recreation to start against stale state. Never infer the active database solely from existence or file age when `.env` specifies `DATABASE_FILE`.

Before migration:

1. create SQLite-safe `.backup` copies for all database files;
2. stop the main application before replacing/canonicalizing an active database;
3. validate the destination with `PRAGMA quick_check`;
4. preserve the previous database file for rollback rather than deleting it;
5. update `.env` before recreating the application;
6. verify the live container's `DATABASE_FILE`, administrator account, scheduler and database health after restart.

Maintenance backup/restore and the application runtime must agree on database identity.

## Authentication and capability profiles

An explicitly assigned access profile is authoritative and fails closed. Missing/disabled profiles must not silently regain role-default permissions.

Startup recovery may restore the default capability array only when a built-in profile exists but has a missing/empty/invalid capability list. It must not overwrite a valid non-empty custom list.

Passwords are opaque application strings. Shell troubleshooting must use safe quoting/hidden input because characters such as `!` and `#` have shell meanings even though they are normal password characters to the browser/API/scrypt implementation.

## Setup wizard invariants

Stable receiver IDs are editable. The wizard validates uniqueness and uses the explicit receiver list rather than assuming `tv1..tvN`. When receivers are removed, every display group's member list must be filtered against the remaining devices before the configuration is saved.

Optional service discovery must distinguish these actions:

- **Adopt Existing** — persist/control an already running supported service without recreation.
- **Deploy/Install** — create a missing supported service using the reviewed template.
- **Recreate/Update** — explicit destructive container replacement while preserving managed data.

Do not show a button whose backend path intentionally rejects the same operation.

## Scheduler and automation model

School calendar state affects scheduled operations. No-school days suppress scheduled classroom operations. Remote days advance the cycle but suppress scheduled classroom operations while manual controls remain available. Delay and half-day rules affect schedule resolution.

Morning Announcements override conflicting display automation. Priority is enforced again at each display delivery, not only when an automation starts, so delayed or multi-step work cannot overwrite a takeover that began mid-run. Non-display portions such as lighting continue while only locked display targets are deferred. On release, do not restore stale snapshots. Re-evaluate the current schedule and select the newest currently applicable automation for each display target. If reconciliation fails, keep Background Music paused and retry rather than resuming audio against an unreconciled display state.

Scheduler readiness validates stored class and automation data. Invalid class times such as an end time before the start time must be rejected or repaired before migration is committed; health diagnostics should identify invalid records rather than returning only a generic failure.

## Integration model

Major integrations include MQTT/Govee, Pluto Mark I, Music Assistant / Sendspin, Veyon, Ant Media / HLS, browser display clients, Android/Google TV managed displays, and the native Host Agent.

Integration health must be independent. A Pluto failure must not make MQTT/Govee appear offline. Optional/slow hardware probes should run asynchronously and must not block the Overview screen.

Music Assistant managed Docker deployment uses host networking so local multicast discovery works and keeps its persistent `/data` outside the container. Native `veyon.service` and `veyon-webapi.service` are host-managed; the retired Veyon proxy container is not a supported managed add-on or recovery root.
RoomGoblin-managed Music Assistant recreations also install `/data/.roomgoblin-compat/sitecustomize.py` and set `PYTHONPATH` to it. This guard filters only Linux adapters whose `operstate` is explicitly `down` before Music Assistant/ifaddr builds Zeroconf interface lists; it exists to prevent dual-stack startup failure on hosts with Tailscale IPv6 plus inactive addressed Docker bridges. Preserve active/unknown interfaces and fail open when state cannot be read. RoomGoblin-owned containers require an explicit recreate to gain the guard, and that recreate must not be blocked by an offline Music Assistant authentication preflight. Foreign/adopted containers must refuse destructive recreate until their `/data` is migrated into the managed services root.
A live 2026-09-18 appliance also retains a separate legacy Compose deployment at `/opt/music-assistant` with `/opt/music-assistant/data:/data`. Its permanent repair is an in-place `.roomgoblin-compat/sitecustomize.py` plus `PYTHONPATH=/data/.roomgoblin-compat`; do not migrate that data root merely to apply the Zeroconf guard. Post-reboot acceptance proved Tailscale IPv6 can remain enabled, down Docker bridges can remain addressed, and 8095/8097/8927 remain healthy. Background Music scheduled startup must wait until the configured MA player is present/available and back off transient start failures rather than hammering `play_media` during provider initialization.

Background Music runtime tracks the player that actually started playback. Pause, stop, and resume must address that player even if configuration changes or a manual request supplied a player override. Changing the configured player or favorite while active stops the prior playback identity before reconciling the new schedule.

## Android / Google TV managed-display invariants

The first physically validated target is the Onn 4K Streaming Device running Android 14, product `wayne`, build `UKRB.260113.075.A1`.

Preserve these invariants:

- Enrollment/pairing and assignment/configuration are separate workflows.
- Pair once to establish ADB trust and a stable managed-device ID; use Edit for school/building/room/profile/display URL changes.
- Display Agent package is `org.roomgoblin.display`.
- Android inventory and ADB key material under `data/android-tv/` are persistent runtime state.
- The maintenance container has one deliberately writable persistent ADB-key path: `/managed/classroom-hub/data/android-tv/.android`, backed by the named Docker volume `classroom-control-hub-android-adb`.
- Any release path that may change core Compose mounts must force-recreate the maintenance container. The GUI updater must not rely on plain `docker compose up -d`; it force-recreates core services and verifies the ADB key directory is writable before accepting the release.
- A blank Managed Displays page or permanent `Checking ADB…` after deployment may indicate Hub-to-maintenance network/proxy failure rather than lost pairing; inspect persistence before re-pairing.
- Hub and maintenance use host networking; maintenance remains loopback-only at `127.0.0.1:${MAINTENANCE_PORT:-3010}` and token-authenticated. Do not reintroduce `maintenance-agent:3010` service-DNS assumptions.
- Persistent ADB is opt-in and for trusted management networks only. The tested Onn preserves pairing trust but disables Wireless Debugging during reboot; the agent restores it and the managed endpoint returns on fixed port `5555`.
- Reboot is asynchronous. Temporary ADB loss is expected; UI uses bounded `Recovering…` state rather than immediate permanent failure.
- ADB may return before Android allows foreground kiosk launch; agent can transition through `Starting…` before `Running`.
- Hub recovery should verify/accelerate agent launch as soon as ADB reconnects instead of waiting for the normal background policy interval.
- Remote-shell compound scripts must be correctly quoted for Android `/system/bin/sh`; never pass an unquoted pipeline/conditional as a fragmented `sh -c` sequence.
- Android deep sleep is not the default scheduled power method on the validated Onn because it can remove the ADB/network management path. Keep kiosk/content scheduling, HDMI-CEC panel power, and advanced Android sleep separate.
- Managed Minimal Mode is reversible: audit first, disable only audited third-party user-0 apps, preserve `org.roomgoblin.display` and Android/Google TV core services, and provide Restore Apps.

Validated lifecycle: pair/enroll -> configure -> install agent -> persistent ADB bootstrap -> unattended reboot -> Wireless Debugging restored -> fixed `:5555` reconnect -> Hub Online -> agent starts -> assigned `/display/<id>` content returns. HDMI-CEC/physical panel power remains separate follow-up validation.

Canonical references: `docs/ANDROID-TV-DISPLAYS.md`, `docs/PERSISTENT-ANDROID-ADB.md`, `docs/MANAGED-ANDROID-MINIMAL-MODE.md`, `docs/ANDROID-TV-SUPPORT-MATRIX.md`, `docs/MANAGED-DISPLAYS-RECOVERY.md`, `docs/ai/ANDROID-TV-CONTEXT.md`, `wiki/Android-TV-Displays.md`, `wiki/Managed-Displays-Recovery.md`.

## Production configuration

The public repository intentionally uses generic configuration. Production endpoints, credentials, room names, calendar values, stream URLs, device IPs, and school-specific mappings must remain local.

The standard production checkout is `/opt/classroom-hub`. Older documentation or code referring to `/opt/classroom-control-hub` is migration-era configuration unless a deployment explicitly chose it.

School/classroom identity, integration settings and update policy are database-backed. Integration passwords, private keys, and tokens belong in the encrypted secret store and must never be returned by browser APIs. Environment variables remain bootstrap/migration fallbacks and host/container boundary configuration.

Browser displays use enabled stable display IDs without credentials by default. This URL-only behavior is an intentional trusted-classroom-network contract and must not silently become mandatory enrollment during security work. Administrators may opt into individually enrolled, revocable credentials after enrolling every enabled display. Enrollment links are one-use and expiring; raw codes and credentials must never be persisted or returned by administrative read APIs. Protected assets remain signed in either mode.

## Git and release workflow

`main` is the only integration/update source during active development. Work on
short-lived branches, pass PR checks, merge to main, and publish its exact image
pair. No production/staging/development branch or environment promotion is used.
Allow merge commits, squash and rebase in both repository settings and the main
ruleset, without bypassing required checks/reviews. Normal supported update flow:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

For development rebuilds after host state is established:

```bash
docker compose build --no-cache
docker compose up -d --remove-orphans
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

The web-managed updater uses GitHub releases and a native systemd job. It must verify backend, maintenance, Host Agent, database/scheduler health, ADB key-storage writability, and version convergence after recreation, and restore the prior source/data state on failure. It force-recreates both core services so new Compose mounts and hardening changes cannot be skipped by an old container. TLS/Caddy is not currently a release-health dependency.

## Documentation map

- `README.md` — public project overview
- `INSTALL.md` — installation/migration quick guide
- `GITHUB-MIGRATION.md` — Git-based migration and update workflow
- `docs/ARCHITECTURE.md` — architecture
- `docs/CONFIGURATION.md` — configuration
- `docs/CONTROLLER.md` — controller UI
- `docs/DATABASE.md` — persistence/database
- `docs/DEPLOYMENT.md` — deployment and rollback
- `docs/DEVELOPMENT.md` — development
- `docs/HOST-AGENT.md` — host agent
- `docs/OPERATIONS.md` — operations
- `docs/TROUBLESHOOTING.md` — troubleshooting
- `docs/ANDROID-TV-DISPLAYS.md` — Android/Google TV management
- `docs/PERSISTENT-ANDROID-ADB.md` — persistent wireless ADB recovery
- `docs/MANAGED-DISPLAYS-RECOVERY.md` — ADB storage/recreation recovery contract
- `docs/MANAGED-ANDROID-MINIMAL-MODE.md` — reversible managed-display cleanup
- `docs/ANDROID-TV-SUPPORT-MATRIX.md` — validated hardware/firmware matrix
- `wiki/` — Git-tracked mirror of GitHub Wiki pages

Update documentation in the same change whenever behavior or operational procedures change.

## Automation execution contract (alpha.72)

- Automation persistence is SQLite-authoritative even though compatibility helpers still use JSON-like file keys. Stale `data/automations.json` files are not authoritative when `LEGACY_JSON_MIRROR=false`.
- `Test Now` is an execution test, not a calendar eligibility test. It may use a linked class as a synthetic manual context when that class is not scheduled on the current day. The real scheduler continues to enforce school-cycle/date eligibility.
- Class-default display targets are a display-domain policy. They apply to primary display actions, display actions embedded in lighting/TV-led automations, and timer overlays. They never become lighting targets.
- Timer overlay failures and action failures must be returned and persisted with actionable details rather than only the generic `Completed with action errors` status.
- A legacy or empty cross-domain step must recover to that domain's `all` selector at execution time and be normalized on its next save. An explicit action target always overrides a linked class's display default. Explicit `all`, `hdmi-all`, and `hdbt-all` TV-power selections use Pluto's matching broadcast CEC command; selected TV subsets use individual output commands.
- Alternating automations use the authoritative school-cycle anchor from the configured schedule profile; the controller must not depend on an editor-only anchor field.

### Maintenance mutation boundary

Authenticated maintenance mutations share an appliance-wide limit of 30 requests per 60 seconds, enforced after token authentication and before both legacy and extension-wrapped routes. Excess writes return HTTP 429 with a Retry-After header; GET/HEAD/OPTIONS polling and health checks do not consume this budget. Forwarding headers cannot create new budgets. The counter is in memory and resets on a maintenance process restart.

## Display merge review boundaries (2026-09-09)

PR #27 retains one logical layout owner and adds `public/display/security.mjs` for receiver URL/proxy/identify validation. Never return a rejected raw URL from a catch block. External media is an explicit HTTP(S) signage feature, not permission to load javascript/data/file schemes or to navigate the top-level receiver. Keep external frames isolated, proxy paths same-Hub and identify resources bounded. See `docs/DISPLAY-LAYOUT-CONTRACT.md` for behavior and browser verification. Renderer revision: `single-fit-20260911-5`, released with alpha.78.

## Host installer group prerequisite

Resolve host GID 10001 before backup/data/secret mutation. The group inside the image is not a host group record. Source `deploy/host-group.sh`, reuse an existing GID or create `classroom-hub` only when its name and ID are free, and pass the verified name to install. Fail closed on conflicts/lookup errors; never renumber existing groups, add host users to this secret-readable group, or regenerate keys for this error. Keep `test/installer-host-group.test.js` coverage and `docs/HOST-NETWORKING.md` recovery instructions synchronized.

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

## Selective main updates and CI

Normal CLI updates select origin/main and use `deploy/update-plan.py` and the journaled native runner. An old installed runner is migrated only after the exact main image pair is verified; the candidate runner forces one full reconciliation and preserves pending-journal recovery. Legacy/deferred branch names are not active update sources. Compare each running image revision and the verified host/deployment record; never infer deployed state from HEAD alone. Preserve per-component image tags and immutable recovery IDs. Unknown deployment/migration inputs or configuration drift trigger full installer reconciliation. Source-only updates preserve the existing rollback point. See `PRODUCTION-UPDATES.md` and `CI-WORKFLOWS.md` for force-full, interruption recovery and the canonical-database limit.

Required publication workflows are now Validate (including Android debug and restrictive-context image coverage), Display browser regression, and Security gates. Semantic releases promote the published SHA image pair instead of rebuilding it. Do not restore duplicate standalone workflows or weaken these gates.

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

## Veyon OEM-only boundary

RoomGoblin supports the host-managed upstream/OEM Veyon installation, its normal configuration, and upstream/OEM add-ons only. Do not vendor, build, install, restore, or expose custom/community Veyon plugins, RoomGoblin-native Veyon bridges, experimental browser tools, local Veyon analysis services, custom endpoint command shells, or pilot package builders. The Veyon web workspace may use only the reviewed upstream WebAPI operations already mapped in the core command allowlist. Feature discovery is informational and must never auto-enable an unreviewed action.

Preserve existing Veyon keys, multi-key authentication, inventory/DHCP identity, host package lifecycle, command recovery, standard monitoring/live view, screen/input lock, messaging, website/application launch, login/logoff, reboot/shutdown, and teacher demonstration controls. Retained command status endpoints are appliance-wide rate-limited, and mutation endpoints use a separate bounded write budget. Upstream/OEM add-ons remain installed/configured by the Veyon/OEM mechanism; RoomGoblin must not synthesize its own replacement plugin or bypass licensing. Read `docs/VEYON-OEM-POLICY.md` before changing Veyon behavior.

## Automation action execution and media-session control

Automation action looping is per-action, never implemented by restarting the whole occurrence. Additional actions persist `executionMode`, `repeatCount`, and `repeatDelaySeconds`; continuous `loop` is native only for `display.media`, while other commands remain bounded repeats. Uploaded video uses a persistent receiver media session. Live play/pause/seek/volume/mute/rate changes use `display.media.control` and must not reissue `display.media`, because replacing the content command restarts playback. Receivers report bounded media-session status for the controller scrubber. Preserve Morning Announcements priority, scheduler winner reconciliation, Background Music recovery, stable receiver IDs and signed media URLs when changing this path.

## Automation sequence runner (schema v3)

Scheduled automation execution is pass-based and canonical on `actionSequence[]`. Every action independently uses `once`, bounded `repeat`, or continuous `loop` participation. The runner walks the ordered sequence and returns to Action 1 while any action remains eligible. Do not restore the old special-primary-action runtime or per-step in-place repeat model.

Continuous loops are valid for every supported action type, not only media. They must be cancellation-aware, class-end-aware, and capped to at most one zero-delay full pass per second. Newer overlapping scheduled occurrences supersede older running loops. Startup reconciliation and operator Resume recover currently applicable continuous occurrences outside the ordinary catch-up window. Manual live draft tests containing a continuous action are bounded to one pass.

Timer Overlay initializes after the first sequence pass so it works with continuous sequences. Morning Announcements still preempt display delivery and post-announcement reconciliation still restores current scheduled winners before Background Music resumes.

The Scheduled workspace uses time-ordered selectors. Media settings are content-aware: image, video, and paged-document controls must not be mixed indiscriminately. The old browser automation hotfix is retired; required compatibility logic belongs in the canonical controller/backend.


### Database and local-storage hygiene

SQLite is the authoritative store for structured configuration, identity,
authorization, scheduler/automation state, encrypted settings and bounded
audit/telemetry metadata. Do not move authoritative relational state to ad-hoc
JSON files as a performance workaround. Conversely, do not put media, diagnostic
archives, screenshots, backups, exports, caches or temporary staging blobs into
SQLite.

High-frequency successful polling belongs in coalesced telemetry rather than
append-only audit rows. Authentication must still validate every request, but
non-security `last_used_at`/last-seen bookkeeping should be rate-limited to
avoid needless WAL churn.

Update safety archives use the `pre-*.zip` naming boundary. Verified app/host
updates retain the newest ten automatic safety backups while preserving the
currently pinned revert backup. Automatic retention must never match user-created
archives or encrypted Full Recovery bundles. Diagnostic downloads are temporary
and must be removed after transfer.


### Database and local-storage hygiene

SQLite remains authoritative for structured RoomGoblin state. Large/generated payloads such as media, screenshots, diagnostics, backups, exports, caches, and temporary staging remain file-backed. High-frequency successful polling belongs in coalesced telemetry rather than append-only audit rows, and non-security last-seen/last-used bookkeeping should be rate-limited.

Automatic backup classification is explicit: update-generated operational archives use `auto-operational-*`, operator-created operational exports use `manual-operational-*`, and historical `classroom-hub-operational-*` archives are legacy automatic backups. Successful maintenance retains 3 automatic operational backups, 1 `pre-*` safety backup, and 3 `migration-*` snapshots. A pinned rollback archive is preferentially retained inside the applicable limit. Never auto-prune `manual-operational-*` or encrypted Full Recovery `.rgbak` bundles. Diagnostic downloads are temporary and must be removed after transfer.


### Backup retention runtime invariant

A full reconciliation must invoke retention after health/version convergence
from the newly installed maintenance layer itself. Do not rely only on the outer
update runner because that runner intentionally executes a stable snapshot from
the previous release. Enforce 3 automatic operational backups, 1 pre-* backup,
and 3 migration snapshots. Host-side migration and legacy cleanup must resolve
the configured `HOST_BACKUP_DIR` (default `/opt/classroom-hub-backups`) and
must not reintroduce the obsolete `/opt/classroom-control-hub-backups` path.
