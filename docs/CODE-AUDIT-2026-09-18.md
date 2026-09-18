# Repository-wide code audit — 2026-09-18

## Scope and method

This audit covered the complete `main` tree at `66498e993914a3836652f06e5838ae52ac76e5e0`:
538 tracked files and approximately 64,600 lines of first-party source, tests,
configuration, workflows, and documentation. The review was split by subsystem,
then integrated and retested on one branch. Generated build output and third-party
dependencies were validated through their manifests, lock files, audit tools, and
CI controls rather than treated as first-party source.

Reviewed areas:

- Hub backend, storage, automation, media, hardware, and browser surfaces.
- Maintenance, recovery, installer, updater, and Host Agent boundaries.
- Veyon, ESPHome, Govee, Pluto, and Music Assistant integrations.
- Android Agent v2, native Windows agent, and legacy PowerShell fallback.
- Docker images, GitHub Actions, dependency manifests, publication gates, tests,
  operator documentation, AI context, and Wiki sources.

## Corrected findings

### Backend and browser

- Prevented recursive Music Assistant failure cleanup and bounded outstanding
  single-use Sendspin tickets.
- Validated media URLs, numeric playback values, scene definitions, lighting and
  AV commands before state persistence or hardware delivery.
- Added credentials to protected Morning Announcements probes without exposing
  them in diagnostics, and cleared stale receiver announcement state.
- Retired the legacy anonymous classroom-session effect timer and cleared stale
  queued effects on startup.
- Restricted Veyon targets to canonical RFC1918 IPv4 addresses and strengthened
  Pluto, Govee, environment, presentation-note, diagnostics, and schedule input
  validation.
- Removed a managed-display DOM injection path and fixed screenshot, volume,
  status, and receiver-generation races.
- Replaced arbitrary device-config projections with an explicit public schema.

### Persistence, maintenance, and recovery

- Coalesced routine session maintenance writes while retaining immediate expiry,
  revocation, disabled-user, and profile enforcement.
- Reopened the maintenance credential probe after atomic SQLite replacement.
- Made Music Assistant alias snapshots generation ordered and short-lived.
- Added fsynced recovery journals for interrupted compatibility restores and
  full-export service quiescence, plus startup reconciliation and health checks.
- Enforced archive/body/retention limits, serialized maintenance mutations, and
  surfaced add-on restart failures instead of silently continuing.
- Bound Host Agent request bodies, required the exact managed-container ownership
  label, bound the listener before recovery work, and narrowed systemd writable
  paths.
- Disabled the obsolete unverified Android installer route.

### Veyon and ESPHome

- Redacted authentication payloads and connection identifiers from Veyon diagnostics.
- Added collision-resistant hostname identities, atomic DHCP identity changes,
  and cryptographic bounded private-key parsing.
- Added bounded ESPHome worker restart backoff, including synchronous spawn
  failures, and restored ESPHome to the integration catalog.

### Managed devices

- Android live configuration now rebinds or disables its listener correctly;
  request bodies, root commands, root output, and root capability claims are
  bounded and policy truthful.
- Protected exported Android helper activities and activated the declared media
  playback foreground-service type.
- Serialized native Windows WebSocket sends; bounded updates, history,
  screenshots, and pipe messages; corrected certificate hashing and quoted the
  service image path.
- Made one-use enrollment deletion fail closed and removed secret-bearing backup
  files.
- Hardened the PowerShell fallback against untrusted schemes, PATH/reparse SQLite
  resolution, unbounded output, and accidental removal of native shared state.

### CI and supply chain

- Added lock-file and dependency-update coverage for Gradle and NuGet inputs.
- Tightened workflow permissions, timeouts, artifact verification, and native
  Windows validation.
- Changed image publication so the tested/scanned image artifacts are promoted
  instead of independently rebuilding potentially different bytes.
- Added integrity pins for downloaded Android build inputs and strengthened
  release/source identity checks.

## Validation record

- Complete Node test suite: 575/575 passing after integration with the latest
  `main` changes.
- JavaScript syntax and controller validation: passing.
- Python Host Agent, Veyon tool, and Veyon AI tests: passing.
- Shell syntax, JSON/XML parsing, dependency audits, and diff whitespace checks:
  passing.
- GitHub Actions remains the authoritative environment for Docker/Compose,
  Android Gradle, native .NET, PowerShell, CodeQL, and image-vulnerability checks
  because those runtimes are not installed in the local review environment.

## Known architectural follow-up

The normal web-managed update path already has a durable host-owned transaction
and rollback journal. A direct manual reinstall that invokes `install.sh` outside
that updater does not yet have an equivalent crash-time rollback consumer. Adding
only an error trap or metadata file would create false safety and could restart a
mixed source/data state. Existing installations should continue to use the
journaled application updater; designing a second host-owned installer transaction
is tracked as an architectural follow-up rather than weakened in this patch.

## Live controller click-through follow-up

A post-audit appliance walkthrough exercised the controller screens and controls while a diagnostics snapshot was collected. Core Hub, scheduler, MQTT, configured hardware integrations, Veyon reachability, and managed displays were healthy in that snapshot. The walkthrough identified one reproducible application regression in the current UI path: the Controller generated its own `/test-images/tvN.svg` URL, while backend media validation rejected that path. The fix narrowly permits only the eight shipped test-card assets and adds traversal/out-of-range regression coverage.

The walkthrough also encountered host/configuration-dependent responses from optional Veyon integration paths. The supported configuration is now restricted to the host-managed upstream/OEM Veyon installation and upstream/OEM add-ons; removed custom extension paths are not part of current operation.

The diagnostics database contained substantial historical audit data. Current `main` already coalesces successful high-frequency GET/service polling into `telemetry_state` and provides bounded audit-retention pruning; no second competing retention mechanism was added during this follow-up.



## Database and local-storage performance follow-up

A post-deployment storage review identified three avoidable persistence costs.

- Display and Windows/lab-agent authentication updated credential
  `last_used_at` on every successful request. Authentication remains immediate,
  while the bookkeeping timestamp is now coalesced to five-minute intervals to
  reduce WAL/write amplification.
- Diagnostic ZIP downloads were created under persistent `data/backups`.
  They now use maintenance temporary storage and are removed when the HTTP
  transfer completes.
- Application and Ubuntu host updates created automatic `pre-*.zip` recovery
  points but did not invoke the existing retention facility after success.
  Verified updates now retain the newest ten automatic safety archives while
  preserving a currently pinned revert backup and excluding user-created/full
  recovery archives.

The storage-boundary review did not find a reason to move authoritative
configuration, scheduler, identity or encrypted-setting records out of SQLite.
Large/generated payloads remain file-backed; high-frequency successful polling
remains coalesced telemetry; audit rows remain subject to privacy retention.


## Veyon OEM-only cleanup follow-up

The custom/community Veyon plugin, browser-bridge, terminal, clipboard, Internet Guard, file/chat pilot and local-analysis source paths were removed. The retained Veyon command/status APIs remain on the upstream/OEM WebAPI boundary and now use explicit appliance-wide status/write rate limits. CI guards assert that the retired extension trees and pilot build/deployment scripts cannot return unnoticed.


## Database and local-storage performance follow-up

The live production inventory after alpha.84 showed approximately 21 GiB beneath `data/backups`, dominated by repeated 600-644 MiB `classroom-hub-operational-*.zip` files created during updates. Earlier update runners created those generic names while retention matched only `pre-*`, allowing large automatic archives to accumulate indefinitely.

The corrected policy classifies future update archives as `auto-operational-*`, manual exports as `manual-operational-*`, treats historical `classroom-hub-operational-*` as legacy automatic archives, and automatically keeps 3 operational automatic backups, 1 `pre-*` backup, and 3 migration snapshots. Full Recovery bundles remain protected. Display/lab-agent credential last-used timestamps remain coalesced to reduce SQLite WAL churn, and diagnostic ZIP downloads use temporary storage rather than persistent backup storage.


### Live retention follow-up

Live deployment of the first retention build exposed two remaining execution
mismatches. The outer updater was still running its intentionally stable
pre-upgrade snapshot, so its final retention call used the previous keep=10
policy during the same upgrade. In addition, Host Agent migration discovery
still referenced the obsolete `/opt/classroom-control-hub-backups` path while
the appliance was configured for `/opt/classroom-hub-backups`.

The corrected design runs 3/1 ZIP retention from the converged installer itself
and resolves migration/legacy host backup paths from `HOST_BACKUP_DIR`.
