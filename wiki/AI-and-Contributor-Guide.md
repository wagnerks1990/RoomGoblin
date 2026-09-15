# AI and Contributor Guide

See [Host Networking](Host-Networking) for the current Linux container topology, loopback-only maintenance API, explicit add-on migration, listener ports and recovery rules.

AI coding assistants and contributors must use `main` as the sole integration/bootstrap/update branch during active development. Use short-lived branches and checked PRs, not production/staging/development promotion branches or environment approvals. Deployment still requires the exact validated immutable image pair. Repository and main-ruleset settings must both allow merge, squash and rebase while retaining checks, review-thread resolution and branch protections.

## Read first

1. `AGENTS.md`
2. `VERSION` and `CHANGELOG.md`
3. `docs/AI-CONTEXT.md`
4. `docs/ROOM-TOPOLOGY.md` and `docs/ai/ROOM-TOPOLOGY.md` before changing TVs, displays, sources, AV routing, classes, automation targets, presentations, media, Morning Announcements, or Music Assistant TV selection
5. the relevant `docs/` topic page
6. the matching focused `docs/ai/` context when present
7. implementation source

For CI/release publication, read `docs/ai/CI-PUBLICATION.md`. For production shared-data permissions and backup readability, read `docs/ai/PRODUCTION-SHARED-DATA.md`. For physical-TV/content-display/content-source targeting, read `docs/ai/ROOM-TOPOLOGY.md`. For managed Android package migration and Device Admin behavior, read `docs/ai/ANDROID-TV-SENDSPIN-DEVICE-ADMIN.md`.

## Live upgrade corrections

See [Alpha.82 upgrade recovery](Alpha82-Upgrade-Recovery). Preserve GID 10001
access to SQLite and ADB trust while keeping other-user access disabled. Also see [Main Publication and Shared Data](Production-Publication-and-Shared-Data) before changing Hub startup, uploads, backups, or image publication.

## Current baseline

The current production-readiness review baseline is `1.0.0-alpha.82`.

Critical invariants:

- A merged `main` commit is not automatically deployable. Every main push starts `Publish Main Images`, which independently waits for exact-SHA `Validate`, `Display browser regression`, and `Security gates`, publishes the Hub/maintenance pair, and promotes package aliases only. No deployment source branch is created or advanced.
- Do not restore indirect `workflow_run` publication triggering. The publisher must use the exact `github.sha` from the main push and fail closed if any required workflow for that same SHA fails, is skipped, is cancelled, or does not complete.
- The maintenance Android image may retry a broad transient Maven/Google dependency-resolution failure only in a bounded fail-closed loop. Deterministic Gradle failures and APK identity/version/checksum failures still block publication.
- The Hub runtime starts through `tools/start-roomgoblin.sh` with `umask 0027`. Ordinary persistent application files must remain owner-writable and group-readable to GID 10001 so maintenance can back them up without granting world access.
- A production update must complete its mandatory operational safety backup before mutating services. Never bypass that backup; repair only the specific incorrect application-data permission when an `EACCES` failure is diagnosed.
- The appliance is temporarily HTTP-only for ordinary administration and restricted to a trusted classroom/admin LAN; Caddy/TLS is intentionally deferred. Full Recovery passphrases require loopback or HTTPS terminated by a same-host loopback reverse proxy.
- Full Recovery uses one AES-256-GCM `.rgbak` envelope with scrypt `N=32768/r=8/p=1`, random salt/nonce, authenticated canonical metadata and bounded payloads.
- Maintenance stages only authenticated allowlisted state; the Host Agent owns final paths/permissions, takes a complete safety snapshot, journals the transaction durably and rolls every changed root back after failure or interruption.
- Full Recovery Export holds the Host Agent appliance lock plus a one-use Hub writer freeze before database selection, drains existing writers, queues audits, and stable-copies/revalidates master, ADB, signing and Veyon identities. Both locks thaw on every outcome and have bounded crash leases.
- Database/master key, ADB trust/named volume and Android signing identity are indivisible recovery sets; every encrypted database secret must decrypt before acceptance.
- Only explicit RoomGoblin-owned service state with its fixed reviewed image identity may be recreated. Adopted/external collisions fail closed and owned stopped services remain stopped.
- `DATABASE_FILE` is authoritative. Installer migrations take SQLite-safe backups of every database, stop the app before active-database canonicalization, validate with `PRAGMA quick_check`, and preserve the prior file for rollback.
- Explicit access profiles fail closed. Built-in profiles with missing/empty capability arrays are repaired without overwriting valid custom lists; Administrator resolves to `capabilities:["*"]`.
- Passwords are opaque strings; punctuation such as `!` and `#` must survive browser/API/scrypt paths and shell troubleshooting must quote credentials safely.
- Maintenance startup health checks the Host Agent directly rather than waiting for the main application.
- Room topology is canonical and domain-separated: physical TVs, content displays, content sources, and lighting are not interchangeable inventories.
- Stable IDs survive friendly-name changes. `All TVs` resolves against enabled physical TVs; `All Displays` resolves against enabled content receivers; typed groups never cross domains.
- Legacy `devices`, `displayGroups`, and Pluto labels are compatibility projections. Do not infer physical-TV inventory from content-display rows or hard-code `tv1..tv8` application-wide.
- Adapter cardinality is local to the adapter. Pluto may remain an 8×8 AV surface while RoomGoblin contains additional TVs/sources on other adapters.
- Removing or disabling a topology item must fail closed for stale saved target IDs; never redirect a missing endpoint to another device implicitly.
- Legacy receiver IDs, display groups, AV mappings, enrollment state, ADB trust and source labels remain compatibility projections while the canonical topology evolves.
- Receiver IDs are stable/editable and display groups must be pruned when receivers are removed.
- The controller inventories existing Docker containers and can adopt them for safe lifecycle/log control.
- New container creation remains restricted to reviewed supported integration templates.
- Supported optional managed Docker add-ons are Mosquitto, Govee2MQTT, Music Assistant, and Node-RED; adoption must not recreate an existing container unless explicitly requested, persistent integration data must survive recreation/removal, and native Veyon services remain host-managed.
- Morning Announcements are highest priority. Recheck their target lock at each display delivery so an already-running delayed automation cannot overwrite a takeover; continue non-display actions rather than discarding them.
- Ant Media live detection uses HLS as the primary signal.
- Announcement audio is locally controlled so mute/volume work.
- When announcements end, the scheduler re-evaluates the current moment and re-triggers winning current display automations before Background Music resumes. Failed reconciliation retains the audio hold and retries.
- Timer chaining is only for an explicitly linked continuation of the same base class or period.
- Runtime versions must stay converged through release metadata/stamping and the Host Agent wrapper.
- Integration health is independent; a failure in Pluto must not falsely mark MQTT/Govee offline.
- Cross-domain automation steps with legacy/empty targets recover to the domain's All selector; an explicit action target overrides a linked class display default. TV-power selectors use the physical-TV domain; display actions/classes remain in the content-display domain.
- Optional or slow hardware probes must not block the initial Overview screen.
- Legacy `org.classroomhub.display` migration may require one native Device Administrator confirmation on the TV because Android blocks silent removal of a production/non-test admin. Normal `org.roomgoblin.display` updates stay in-place with `adb install -r` and preserve Device Admin.

## Standard production layout

```text
/opt/classroom-hub
/run/classroom-control-hub/host-agent.sock
```

Optional managed Docker services:

```text
mosquitto                 eclipse-mosquitto:2.0.22
govee2mqtt                ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72
music-assistant-server     ghcr.io/music-assistant/server:2.9.13
nodered                   nodered/node-red:4.1.14-22
```

These reviewed identities are exact allowlist values, not examples. Do not
replace them with mutable `latest` tags. Native `veyon.service` and
`veyon-webapi.service` are host-managed; the retired Veyon proxy container must
not be deployed.

Production runtime `.env`, databases, data, uploads, backups, integration data, private keys, master keys, tokens, endpoints, and site-specific mappings must remain outside Git.

## Main update flow

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

The historical filename and native `published` action are compatibility identifiers. The updater selects main and verifies its exact commit-matched Hub/maintenance images before changing source or services. It never deploys an unbuilt commit merely because source CI passed. Use [Main-based updates](Production-Updates) for the one-time outside-checkout migration from an old production-following updater. Preserve pending journals, divergent local commits and old branches; later updates selectively recreate changed runtime components.

The installer is part of the supported upgrade path because it reconciles secrets, Host Agent code, data-root ownership, database identity, HTTP exposure, and migration state before container recreation.

Always take a backup before live upgrades. The updater's mandatory operational safety backup must also succeed before service mutation.

## Documentation contract

Behavior, architecture, deployment, configuration, recovery, security, CI/publication, topology, or persistent-data permission changes must update the relevant `docs/` page and matching `wiki/` mirror page. Material changes that affect future implementation choices must also update the appropriate `docs/ai/` context.

For publication/shared-data changes, keep `docs/CI-WORKFLOWS.md`, `docs/PRODUCTION-UPDATES.md`, `docs/PRODUCTION-PUBLICATION-AND-SHARED-DATA.md`, `docs/ai/CI-PUBLICATION.md`, `docs/ai/PRODUCTION-SHARED-DATA.md` and their matching Wiki pages synchronized. An AI connection without administrative writes must report any remaining main-ruleset merge-method setting instead of claiming it changed it or bypassing protection.

Topology changes must also update `docs/ai/ROOM-TOPOLOGY.md` so future AI work retains the TV/display/source domain boundaries.

The complete AI operating contract lives in `AGENTS.md`; `docs/AI-CONTEXT.md` contains the compact technical handoff.

## Dedicated Sendspin transport (selective PR #22 migration)

TVs retain PR #27's ticketed, same-Hub socket validation. The backend alone connects to the configured `sendspinHost:sendspinPort` (normally `:8927/sendspin`) using `src/music-assistant-sendspin.js`. Music Assistant control remains on the authenticated API; never send its token/auth preamble to the raw Sendspin port or consume the first audio/protocol frame as an auth reply. Preserve PR #28's exact host-alias mapping and saved remote/IPv6 settings. The relay bounds buffers and cancels connection timers on all close/error paths.

Do not restore the stashed legacy `server.js`, run PR #22 patch scripts, merge its old font-sizing code, or switch receivers to direct MA sockets. No renderer, SDK, autoplay, database, enrollment or Compose changes are part of this migration. See [Music Assistant Sendspin](Music-Assistant-Sendspin) for the file-by-file review, tests and upgrade acceptance procedure.
