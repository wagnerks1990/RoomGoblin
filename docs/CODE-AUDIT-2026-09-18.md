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

- Redacted authentication payloads and connection identifiers from prepared
  Veyon pilot diagnostics.
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

The walkthrough also encountered host/configuration-dependent 503 responses from optional Veyon community pilots and a Cloudflare provisioning failure from a runtime started before the latest host-install correction. Those are not treated as evidence of core Veyon or scheduler failure. Optional pilot controls remain dependent on their documented endpoint/service prerequisites, and Cloudflare provisioning must run on an updated appliance where `cloudflared` package installation occurs outside the sandboxed Host Agent.

The diagnostics database contained substantial historical audit data. Current `main` already coalesces successful high-frequency GET/service polling into `telemetry_state` and provides bounded audit-retention pruning; no second competing retention mechanism was added during this follow-up.

PR validation also exposed a Firefox-only terminal teardown race: the browser Close action was queued behind terminal state/read polling, while Chromium happened to dispatch it before the test assertion. Cleanup now bypasses the polling queue and immediately sends the authenticated terminal close request; the server-side session expiry remains the fallback if transport confirmation fails.
