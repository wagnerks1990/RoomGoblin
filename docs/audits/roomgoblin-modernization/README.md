# RoomGoblin modernization audit

## Current status

This index is the current status authority. The [progress history](progress-history.md)
preserves the original running notes, including statements that were accurate
before later merges. Individual findings identify their baseline and validation
scope; their historical "pending" text does not override a later delivery receipt.

The final runtime batch is verified at alpha.85 main `fab0e5f`:
[PR #346](https://github.com/wagnerks1990/RoomGoblin/pull/346) records passing
required CI, exact image publication and backed-up production acceptance,
including retention PR #343, publication retry PR #344 and request deadlines
PR #345. The rollback point is the earlier [diagnostics deployment](diagnostics-delivery.md).
All 357 browser cases passed in each engine. ADB keys and Android signing identity
are unchanged; the separately updated Apple Music provider is authenticated.

Acceptance exposed [stale ADB recovery guidance](adb-recovery-guidance.md).
Its documentation-only reconciliation preserves the verified runtime and mount
permissions. The [final integration contract](final-integration.md) and delivery
records distinguish source synchronization from service recreation.
[PR #347](https://github.com/wagnerks1990/RoomGoblin/pull/347) records the
guidance checks, Wiki synchronization and latest source acceptance; it retains
PR #346 as the runtime deployment and rollback evidence.

The [2026-10-29 acceptance follow-up](live-acceptance-follow-up.md) records refreshed
appliance/provider checks, the unavailable physical test target and the operator
session prerequisite. It adds an isolated restore drill with real SQLite data,
encrypted fixture values and rollback after failed readiness. Physical acceptance
remains explicitly separate from those passing fixtures.

"Delivered" below means the documented fixes passed their recorded checks and
backed-up delivery. It does not assert a line-by-line audit of every repository
file or physical acceptance of every device. Full versus targeted source review,
reproductions, intermediate failures and untested boundaries remain in the
linked evidence.

## Scope and evidence

The original 32 subsystems were organized into 17 sequential review units. The
table maps every requested subsystem to its principal evidence. Additional
focused findings and delivery receipts remain indexed in the progress history.
The [metadata supplement](finding-metadata.md) supplies classifications and
immutable repair locations for the condensed notes, preserving their existing
IDs, original evidence and validation scope.

| Requested subsystem | Principal evidence | Current state |
| --- | --- | --- |
| 1. Core architecture and lifecycle | [Lifecycle ownership](core-lifecycle.md), [validation history](validation.md) | Delivered within documented scope |
| 2. Shared frontend and design system | [Shared styles, shell and focus](shared-frontend.md) | Delivered within documented scope |
| 3. Navigation and controller workspace | [Shared frontend](shared-frontend.md), [account dialog focus](account-dialog-focus.md) | Delivered within documented scope |
| 4. Today dashboard | [Overview and preview ownership](today-dashboard.md) | Delivered within documented scope |
| 5. Live displays monitoring | [Today/live monitoring](today-dashboard.md), [receiver runtime](display-receiver.md) | Delivered within documented scope |
| 6. Receiver and kiosk engine | [Receiver runtime](display-receiver.md), [identity delivery](receiver-identity-delivery.md) | Delivered within documented scope |
| 7. Displays and AV routing | [Workspace](displays-av.md), [bounded status transport](av-status.md) | Delivered within documented scope |
| 8. Automation scheduler | [Scheduler findings](scheduler.md), [recovery limits](scheduler-recovery-boundary.md) | Delivered; recovery limit documented |
| 9. Automation editor | [Save ownership](automation-save-ownership.md), [date handling](automation-editor-dates.md) | Delivered within documented scope |
| 10. Planning, calendar and timetables | [Draft ownership](planning-draft-ownership.md), [date boundaries](planning-class-boundaries.md) | Delivered within documented scope |
| 11. Class schedule management | [Class save ownership](class-save-ownership.md), [block identities](planning-block-identities.md) | Delivered within documented scope |
| 12. Morning Announcements and Live Watch | [Priority](announcement-priority.md), [monitoring](announcement-monitoring.md) | Delivered within documented scope |
| 13. Background Music and audio priority | [Session delivery](music-session-delivery.md), [TV recovery](music-tv-recovery.md) | Delivered within documented scope |
| 14. Media playback and content | [Media ownership delivery](media-ownership-delivery.md), [reconnect delivery](media-reconnect-delivery.md) | Delivered within documented scope |
| 15. Presentation library and console | [Session delivery](presentation-session-delivery.md), [rebuild delivery](presentation-rebuild-delivery.md) | Delivered within documented scope |
| 16. Media and document library | [Library recovery](media-library-recovery-delivery.md), [controller delivery](media-controller-delivery.md) | Delivered within documented scope |
| 17. Lighting and Govee | [Reliability](lighting-reliability-delivery.md), [configuration](lighting-configuration-delivery.md) | Delivered within documented scope |
| 18. ESPHome devices | [Reliability delivery](esphome-reliability-delivery.md) | Delivered within documented scope |
| 19. Lab, Veyon and managed agents | [Veyon](veyon-reliability-delivery.md), [Windows](windows-native-bounds-delivery.md), [Ubuntu](ubuntu-reliability-delivery.md), [Android](android-native-delivery.md) | Delivered within documented scope |
| 20. Weather and Sports | [Weather workflow](weather-workflow-delivery.md), [Sports durability](sports-durability-delivery.md) | Delivered within documented scope |
| 21. Backend services and API | [Settings transactions](settings-identity-transaction.md), [database delivery](database-transactions-delivery.md) | Delivered within documented scope |
| 22. Database and migrations | [Legacy imports](legacy-import-transaction.md), [audit imports](audit-import-transaction.md) | Delivered within documented scope |
| 23. Authentication and sessions | [Display admission](display-enrollment-admission.md), [identity delivery](receiver-identity-delivery.md) | Delivered within documented scope |
| 24. Security and secret management | [Identity](display-identity-runtime.md), [diagnostic redaction](diagnostic-evidence.md) | Delivered within documented scope |
| 25. Diagnostics and observability | [Evidence and redaction](diagnostic-evidence.md), [delivery](diagnostics-delivery.md) | Delivered within documented scope |
| 26. Infrastructure and integrations | [Evidence boundaries](diagnostic-evidence.md), [retention authority](backup-retention-authority.md) | Delivered in PR #346 |
| 27. Backup and disaster recovery | [Lifecycle/drain evidence](validation.md), [retention authority](backup-retention-authority.md) | Delivered in PR #346 |
| 28. Updates, deployment and rollback | [Production update contract](../../PRODUCTION-UPDATES.md), [retention](backup-retention-authority.md) | Delivered in PR #346 |
| 29. Performance and resources | [Request deadlines](browser-request-deadlines.md), [AV read budgets](av-status.md), [native bounds](windows-native-resource-bounds.md) | Delivered in PR #346 |
| 30. Tests, CI and releases | [Publication retry](publication-candidate-retry.md), [CI contract](../../CI-WORKFLOWS.md) | Delivered in PR #346 |
| 31. Documentation and developer experience | This index, [ADB guidance](adb-recovery-guidance.md), progress history and linked contracts | Guide reconciliation; see current delivery record |
| 32. Cross-system integration | [Final qualification and acceptance](final-integration.md), delivery receipts | Runtime accepted; documented scope limits |

## Architecture and compatibility decisions

Retain Node/Express, CommonJS, SQLite and the framework-free browser. The Hub owns
operator APIs, scheduling and integration coordination; uploaded-media bytes use
their dedicated process/listener. Maintenance and the native Host Agent remain
separate authenticated privilege boundaries. Compatibility bridges are registered
explicitly per application after writer tracking.

Keep current deployment/service names, persistent identities, receiver IDs,
databases, secrets and signing/ADB material. Preserve Morning Announcements
priority, Background Music reconciliation, timer continuation rules, the original
TV routing matrix and persistent receiver media sessions. Shared operator styling
stays scoped to `body.rg-workspace`; physical display rendering remains independent.

No broad framework rewrite, arbitrary root command API or dependency migration is
needed for these reproduced defects. Production acceptance uses the normal updater,
an integrity-checked operational backup, exact published image identity and a
verified rollback point.

RG-UI-001 is closed by the shared frontend delivery. RG-DOC-001's stale backup
limits are corrected in merged retention PR #343 and included in the final batch.

## Acceptance limits

- The linked tests use simulated failures and device adapters. Health, source
  hashes and read-only configuration checks do not prove physical TV, lighting,
  audio, kiosk or receiver behavior. No physical command or production fault
  injection is claimed.
- Scheduler recovery restores current winners and complete continuous occurrences.
  Later-loop phase and adapter latency are not reconstructed; see the
  [documented recovery boundary](scheduler-recovery-boundary.md).
- A browser deadline ends the browser wait and retires late responses. It does not
  prove server cancellation or a failed physical command; uncertain writes require
  status inspection before retry.
- The non-root full Linux run reports two skipped ownership tests. Both passed
  separately in an isolated root WSL fixture run; see [final integration](final-integration.md).
  CI supplies container, scan, platform and browser qualification. Local results
  and live deployment receipts are recorded separately.
- The optional physical Securly kiosk and external services keep their established
  ownership. This review does not replace site-specific hardware acceptance or
  claim every optional integration is configured.
