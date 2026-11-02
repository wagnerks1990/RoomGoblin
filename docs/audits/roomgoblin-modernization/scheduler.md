# Scheduler run-loop review

Current reconciliation: [later-loop recovery is a documented compatibility
limit](scheduler-recovery-boundary.md); cross-date class resolution has been
repaired. The baseline findings and qualification history below are preserved.

Baseline: `d3c41b1217ad14e2d896bc28fe239c0072b6e7d0`, alpha.85.
Status: checked merge and appliance delivery completed in PR #277 on 2026-10-27.
See the validation record and PR for the verified deployment receipt.

## Inspection boundary

Fully inspected `src/automation-runtime.js`, `src/automation-schema.js`,
`docs/AUTOMATION-FRAMEWORK.md`, `docs/TV-POWER-AUTOMATION.md`, and the
`runClassroomAutomation` owner at baseline `src/server.js:1812-1989`.
Reviewed its action normalization, dispatch, suppression, timer overlay and
physical TV-lock dependencies. The scheduler dispatch/cleanup and resource-key
boundaries have additional candidates under investigation. This document does
not close the complete scheduler engine or automation editor audit.

## RG-SCHED-001: Continuous sequences could monopolize the event loop

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation run loop / Reliability and performance |
| Priority / confidence | P1 / Confirmed |
| Exact baseline locations | `src/server.js:1846-1855,1891-1986` |
| Complexity / compatibility risk | Small / Medium: dwell and cancellation semantics |
| Expected benefit | Bound command frequency and let HTTP, timers and cancellation run |
| State | Identified, reproduced, implemented; local qualification passed; CI and delivery pending |

The framework documentation promises a minimum one-second continuous cycle.
The actual owner advanced directly between passes when actions and configured
delays completed immediately. An async function resolving in microtasks does not
give ordinary timers an event-loop turn. Fast or blocked continuous actions could
therefore repeat without the promised floor and delay cancellation and HTTP work.

Two bounded regressions failed on the baseline: three passes began at
`[0,0,0]` instead of `[0,1000,2000]`, and cancellation scheduled during a wait
was never observed because no wait occurred. The fixtures cap passes so a broken
implementation cannot hang the test process.

Each continuing continuous pass now counts actual action execution and configured
dwell toward one second, then waits only for the remaining duration. Slow passes
still yield once to ordinary timers. A finished pass, finite-only sequence,
single remaining continual action and explicit maximum-pass limit do not gain
an extra wait. The existing cancellation-aware wait retains checks at intervals
of at most 500 ms. Wait duration uses a monotonic clock; school/class-window
eligibility continues to use the scheduler clock.

Tests cover zero-delay and slow actions, cancellation, shutdown interruption,
scheduler pause, class end, configured dwell, finite/single-action behavior,
wall-clock corrections and a real native timer between two passes. They execute
the actual runner with controlled device adapters; no physical command is sent.

## RG-SCHED-002: Clock corrections changed configured wait durations

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation waits / Reliability |
| Priority / confidence | P2 / Confirmed |
| Exact baseline locations | `src/server.js:1846-1854` at the baseline above |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Preserve dwell duration while retaining real class deadlines |
| State | Identified, reproduced, implemented; local qualification passed; CI and delivery pending |

Configured pre-action/dwell waits used `Date.now()` for elapsed time. A clock
correction could lengthen or shorten the wait. The bounded fake-clock regression
moved the wall clock back one hour during a one-second pre-action wait: the
baseline waited 3,601,000 ms instead of 1,000 ms. The corrected monotonic wait
passes forward and backward clock corrections. Scheduler class-end eligibility
continues to follow wall time and is tested separately.

## RG-SCHED-003: Persistence failures stranded run ownership

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduled, recovered and manual tasks / Reliability and lifecycle |
| Priority / confidence | P1 / Confirmed by six failure regressions |
| Exact baseline locations | `src/server.js:5831-5865,6000-6025,8554-8570,8600-8603` |
| Complexity / compatibility risk | Medium / Medium: task registration and drain ordering |
| Expected benefit | Release failed tasks without blocking later recovery or shutdown |
| State | Identified, reproduced, implemented; local qualification passed; CI and delivery pending |

Final persistence ran before the cleanup of running-task and metadata registries.
A failed save left a settled task counted as active. Initial ledger errors also
left manual/recovery metadata behind, and scheduled work could reject before its
caller registered the promise. The drain includes that registry, so stale entries
could prevent clean shutdown or recovery. Six original fixtures fail against the
unchanged baseline owner sections; two hold/interruption controls already pass.

All three paths now use one owned task helper. It registers metadata and the
tracked task before executing its callback on the next promise turn. An outer
finalizer always removes task, metadata and cancellation state, regardless of
ledger or final-save failure. Error diagnostics run inside the tracked owner.
Manual/recovery admission is persisted before creating metadata or superseding
older work. A failed new manual admission save cannot cancel the existing run.

The fixtures execute actual tick, recovery, manual and export-tracking functions
with a controlled persistence adapter. They verify failed admission dispatches
nothing, completed occurrences are not replayed, accepted work remains owned
until its adapter settles, and shutdown still records interruption rather than
operator cancellation. No production failure injection is performed.

## RG-SCHED-004: Manual draft documentation described retired one-pass behavior

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation operations / Documentation |
| Priority / confidence | P3 / Confirmed by both live-run route implementations |
| Exact baseline locations | `docs/AUTOMATION-FRAMEWORK.md:58,121-124`; `src/server.js:6028-6036,6101-6113` |
| Complexity / compatibility risk | Small / Low; documentation only |
| Expected benefit | Make Stop Run and managed manual-run expectations consistent |
| State | Identified and corrected; existing execution behavior preserved |

The early Manual execution section said continual draft tests execute one pass,
while the later section and both saved/draft routes start managed background runs.
The early section now states the current run-ID and Stop Run behavior. It does not
change either API, execution mode or receiver-native media looping.

## Remaining scheduler review

The follow-up in PR #278 covers legacy TV claims/physical locks, test-clock
permission, resource identity and replacement dispatch ordering. See the linked
audit records for their separate baseline reproductions and qualification.
Cancellation persistence passed all checks and is deployed through PR #281; see
the [cancellation follow-up](scheduler-cancellation.md).
The remaining test-clock dispatch boundaries and pause-save ordering are
validated and deployed through PR #282; see the
[dispatch-permission follow-up](scheduler-dispatch-permission.md). Cancellation
retention is validated and deployed through PR #283; see the
[Stop-retention follow-up](scheduler-stop-retention.md).
[TV/lighting recovery timing and ownership](scheduler-recovery-timing.md) passed
all 14 checks and merged in PR #284; publication/delivery are pending.
[Display recovery timing](scheduler-display-recovery.md) is implemented with
combined native qualification complete. Lighting-group and physical-TV recovery
identity defects have local reproductions and remain queued for the next focused
patch. Later-pass phase and cross-date resolution remain open. The editor is a
separate unit. This does not
close the complete scheduler engine audit.


## Qualification boundary

The initial timing-only native snapshot passed 1,045 tests with two root-only
ownership skips (1,047 total), plus 23 Host Recovery tests. Adding the shared owner
exposed one old source-location assertion in the full suite: it expected registry
insertion directly inside the tick. The assertion now follows the shared owner,
checks its insertion and still requires non-blocking dispatch; the executable
owner tests cover the behavior. That intermediate run had 1,053 passed, 1 failed
and 2 skipped (1,056 total), and is not counted as a successful qualification.

The corrected final native snapshot passed **1,054 tests, 0 failed, 2 root-only
ownership skips (1,056 total)**, plus **23 Host Recovery tests**, `npm run check`,
Host Python compilation and tracked Bash syntax. It contains all final scheduler
runtime/tests on baseline `d3c41b1`. Then checked AV merge
`9c15339776e6193b2002a1fccbd0c1e7cbd6f37a` was fast-forwarded into the branch.
The sole overlap was adjacent imports; both the monotonic clock and AV transport
imports were preserved. The combined current tree passed **125 focused native
tests**, 23 Host Recovery tests and syntax checks. CI must run the full combined
suite, platform/browser coverage and image gates before merge/publication.

The initial Windows broad run passed 100 cases and failed the Linux-only storage
mode assertion; native Linux passed it unchanged. Failure injection uses local
fixtures only. No live classroom command, physical fault injection, schema,
version, credential or dependency change is part of this patch.
