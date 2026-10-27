# RoomGoblin modernization audit

Status: **Combined scheduler safeguards merged in PR #278; cancellation follow-up locally qualified**. Legacy TV,
test-clock, resource identity and replacement ordering retain their individual
audit evidence; 1,110 native tests passed with two root-only skips, plus 23 Host
Recovery tests. All 14 PR checks passed; main validation/publication and delivery
are pending. Scheduler timing/task
ownership delivery completed in PR #277. AV backend delivery completed in
PR #276. The operator workspace is deployed through PR #275; receiver browser-runtime
delivery completed in PR #274. Today/live monitoring and shared
frontend delivery completed in PRs #273 and #272. Core Architecture
and Application Lifecycle is complete for its enumerated entry-point scope. The first
implementation covers the bootstrap, media-process ownership, scheduled music
readiness and owned timer cleanup. The follow-up adds a bounded writer drain,
automation interruption/restart policy and export-thaw coordination. The next
follow-up makes route-bridge installation explicit and adds composition tests.
The export follow-up carries mutating handler ownership past HTTP response closure.
The media-stop follow-up propagates child failures without discarding accepted writes.
The discovery follow-up closes lifecycle admission before cache or worker access.
The feature-owner follow-up adds canonical Sports/Ubuntu/presentation lifecycle
and restart coverage without changing their runtime behavior.
The read-housekeeping follow-up closes authentication and update-status writes
during snapshot freeze while retaining read access and authorization checks.
The Veyon read follow-up includes persistent identity/key reads in the snapshot
admission and drain barrier, preserving save-before-project stable IDs.
The presentation recovery follow-up bounds startup reclamation of interrupted
render staging while preserving originals and rebuild behavior.
The connection-cleanup follow-up tracks the two detached Veyon close paths and
pauses idle timer admission while the lifecycle lock is held.
The lab-close follow-up defers disconnect metadata during recovery freeze and
ignores obsolete socket closures without hiding current offline status.
The startup scheduler follow-up defers recovery until snapshot thaw and retains
one pending pass so currently applicable automation winners still recover.
The import-callback follow-up exposes the Sports PDF-processing promise to the
existing drain, including disconnected clients and processing errors.
The enumerated lifecycle entry-point source review, final CI and appliance
delivery are complete through PR #271. This is not a whole-server business
logic or physical-device acceptance claim. Other subsystem units remain queued.

Baseline: `c2808c8ba861b852e6bbe8dec8c52d8251227756`, `main`,
`1.0.0-alpha.85`. Original finding locations belong to that revision. The RG-ARCH-004 follow-up
uses `ea53e2deff70dbb151ca551ddd27b89c633d6afd` as its exact baseline.
The bridge-composition follow-up uses `38db6b8d9bf8fad328fa2639c592b4f739dcca3a`.
The export-handler follow-up uses `da6bb77187bd23787239347db903ab842fbc6683`.
The media-stop follow-up uses `446a9523da9a160bc510e679397269c9097aeb1d`.
The discovery follow-up uses `4ca4f7c4fc81a4b53321e88319e7ea5768d4d211`.

Appliance delivery through PR [#271](https://github.com/wagnerks1990/RoomGoblin/pull/271)
was verified on 2026-10-27 UTC at `40b88c197b2e4d4dbed448348a9d1a9805949dbf`.
The selective update replaced the Hub and retained the healthy maintenance
container at `20f8c501916f34e17bee2c643434e7cce0c919e6`. Health, database/secret
integrity, backup checksum/archive/SQLite integrity and rollback were verified.
No physical classroom commands were issued. See the PR for delivery evidence.

The shared frontend review starts at that same source commit. Its first patch
separates feature presentation from navigation, repairs account/login focus
handoffs and improves default light-theme contrast. See [findings](shared-frontend.md).
Queued subsystem units below have not been marked audited.

- [Legacy TV scheduler findings](legacy-tv-scheduler.md)

- [Scheduler cancellation persistence](scheduler-cancellation.md)

- [Scheduler resource identity findings](scheduler-resources.md)

- [Scheduler replacement ordering](scheduler-dispatch-order.md)
- [Scheduler timing, task ownership and remaining review](scheduler.md)
- [Scheduled sequence test-clock findings](scheduler-simulation.md)
- [Displays & AV backend read bounds](av-status.md)
- [Displays & AV workspace findings](displays-av.md)
- [Display receiver browser-runtime findings](display-receiver.md)
- [Today and live-display monitoring findings](today-dashboard.md)
- [Shared frontend findings and coverage](shared-frontend.md)
- [Core lifecycle findings and coverage](core-lifecycle.md)
- [Validation evidence](validation.md)
- [Current lifecycle contract](../../APPLICATION-LIFECYCLE.md)

## Architecture map

```mermaid
flowchart TD
  entry[npm start / container exec] --> preload[Display gateway preload]
  preload --> recovery[Startup recovery]
  recovery --> media[Supervised media child :3020]
  recovery --> bridges[Ordered compatibility bridges]
  bridges --> hub[Hub server :3000]
  hub --> sqlite[SQLite and encrypted secret storage]
  hub --> operators[Operator UI and receiver WebSockets]
  hub --> integrations[Schedulers and device integrations]
  hub --> maintenance[Authenticated maintenance service]
  maintenance --> host[Native Host Agent]
  media -->|Loopback authorization HEAD| hub
```

The browser remains framework-free. The main Express server still owns multiple
domains. Maintenance and the native Host Agent are distinct privileged boundaries;
they are not additional public browser services. Media bytes have their own
process/listener but share the Hub's authorization and failure domain.

## Inventory and review sequence

These are review units, not proposed new services. Later units remain queued;
their ordering may change when the current unit's evidence warrants it.

| Order | Review units | Principal boundaries |
| --- | --- | --- |
| 1 | Core architecture and application lifecycle | Bootstrap, bridges, child processes, timers, writer drain |
| 2 | Shared frontend architecture/design system; navigation/controller workspace | Shared styles, workspace shell, capability-hidden controls |
| 3 | Today; live displays monitoring | Overview rendering, previews, distinct health signals |
| 4 | Display receiver/kiosk; Displays & AV | Persistent renderer, stable receivers, original routing matrix |
| 5 | Scheduler; automation editor | Occurrences, priority, cancellation, action sequences |
| 6 | Planning/calendar/timetables; class schedules | Saved profiles, exceptions, continuation rules |
| 7 | Morning Announcements; Background Music/audio priority | Priority lock, reconciliation, bounded recovery |
| 8 | Media playback; presentations; media/document library | Content transport, presenter state, uploads, previews |
| 9 | Lighting/Govee; ESPHome | Device lifecycle, discovery, command delivery |
| 10 | Lab/Veyon/Windows agent; managed Ubuntu/Android displays | Enrollment, identity, preview transport, maintenance |
| 11 | Weather and Sports | Fetch budgets, persistence, scene integration |
| 12 | Backend/API; database/migrations | Domain ownership, writer coordination, schema compatibility |
| 13 | Authentication/authorization/sessions; security/privacy/secrets | Fail-closed capabilities and protected identities |
| 14 | Diagnostics/observability; infrastructure/integrations | Accurate health, bounded probes, adoption ownership |
| 15 | Backup/recovery; updates/deployment/rollback | Cooperative snapshots, immutable images, durable transactions |
| 16 | Performance/resources; tests/CI/releases | Measured resource costs and independent release gates |
| 17 | Documentation/AI/developer experience; final integration | Evidence reconciliation and cross-system acceptance |

## Decisions

Retain Node/Express, CommonJS, SQLite, the separate media process and existing
browser architecture. No framework migration or dependency upgrade is needed
for the demonstrated lifecycle defects. Preserve compatibility identifiers and
all operational data. Use focused PRs; production deployment remains separate.

RG-UI-001 (workspace shell ownership) is revalidated in the shared frontend review.
RG-DOC-001 (backup retention documentation) remains queued for its own review unit.
