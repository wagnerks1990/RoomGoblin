# Scheduler dispatch permission

Baseline: `66c54a2b321675905472ea992b88b0f0319ab8fa`, alpha.85.
Status: all 14 PR checks passed; merged in PR #282 as 970cab3; main delivery pending.

## RG-SCHED-016: Direct reconciliation and multi-command actions could bypass dry mode

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduled dispatch / Permission and reliability |
| Priority / confidence | P1 / Confirmed by ten failing executable cases |
| Exact baseline locations | `src/server.js:1016,1065,1493,1703,5890,8689` and their complete function bodies |
| Complexity / compatibility risk | Medium / Medium: more precise dispatch admission |
| Expected benefit | End live test-clock permission before subsequent scheduled commands |
| State | Validated and merged in PR #282; main delivery pending |

Sequence checkpoints did not cover direct recovery actions, timer dispatch or
commands later inside an already entered multi-command action. Reconciliation
could start with a dry test clock; legacy TV work checked permission only once
before the whole tick. A new shared assertion guards action admission and each
display, TV or lighting adapter call. Overlay and display-resync entry use the
same predicate. Reconciliation stops before restoration in dry mode, and rechecks
after accepted display work and between resource winners, before starting music.

Post-announcement resync rechecks between candidates and preserves completed
candidate metadata before returning a skipped result. Legacy TV checks before
each new claim/write and still saves the preceding accepted result. Explicit
manual action/overlay behavior is retained. Accepted adapter calls can finish;
this does not interrupt work already inside an adapter or change transport retry
policy. Independent music/announcement schedulers and the manual-media release
preceding operator Resume retain their separate policies; the whole Resume API
is not claimed free of those earlier independent effects.

Fifteen initial fixtures execute actual action, overlay, resync, reconciliation,
legacy TV functions and SchedulerClock: **5 controls passed, 10 failed** on the
baseline. Two further tests cover post-announcement candidate boundaries and
persistence. Existing timer/audio/TV fixtures now provide the real shared guard
and explicit permitted clocks rather than bypassing it.

## RG-SCHED-017: Failed pause saves changed the runtime flag

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler control / Persistence |
| Priority / confidence | P1 / Confirmed by four failing executable cases |
| Exact baseline location | `src/server.js:212` |
| Complexity / compatibility risk | Small / Low: preserve existing preference shape |
| Expected benefit | Failed pause/resume saves leave runtime and persisted state aligned |
| State | Validated and merged in PR #282; main delivery pending |

The toggle changed the runtime flag before writing its preference. Both enable
and disable could take effect despite a failed save. The candidate preference is
now saved before assigning the flag. Four tests verify both failure preservation
and save-before-project ordering for the two directions; all four failed before
the correction. Surrounding manual-media priority state is a separate boundary.

## Qualification and remaining scope

The complete changed functions, framework contract, callers and associated
timer/audio/TV fixtures were read. The corrected focused suite passes **247 tests**,
including all 21 new cases. Native full qualification is running. Docker is not
available locally; Compose, image builds/scans, browser and native artifact gates
remain CI's responsibility. No schema, device identity, dependency or command
payload change is required. No physical classroom command or production fault
injection was used. Cancellation retention, recovery-winner timing and the editor
remain open review items. Checked merge, Wiki sync, exact images and normal
backed-up delivery are pending.

The first native run had **1,133 tests: 1,130 passed, 1 failed, 2 root-only skips**.
Its only failure was the unchanged media authorization test's adjustable-clock
elapsed assertion: the test runner measured 3,056 ms for the entire case, while
the Date-based assertion exceeded 4,500 ms. This is consistent with an
adjustable-clock change; it does not demonstrate a production transport overrun.
The test now measures elapsed time with `performance.now()` and reports that
value on failure. The 4,500 ms threshold, 3,000 ms production deadline, 503/no-body
response and upstream socket-cleanup checks are unchanged. All eight native media
lifecycle tests and 23 Host Recovery tests pass. A fresh full run is in progress;
the initial failed run is not successful qualification.

The corrected full native snapshot passed **1,133 tests: 1,131 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests** and
Node/controller/Python/Bash checks. Final source and whitespace review passed.
Checked cancellation main will be integrated before final combined qualification
and CI. Earlier qualification-pending statements describe the preceding stage.

Checked main `52e28c6660e9258772f842f8df5eac4517d90a6a` is now integrated,
preserving all cancellation runtime changes and 24 regressions. The combined
focused suite passed **271 tests**. The final combined native snapshot passed
**1,157 tests: 1,155 passed, 0 failed, 2 root-only ownership skips**, plus
**23 Host Recovery tests** and Node/controller/Python/Bash checks. Only documentation
qualification text changed afterward. Fresh CI and delivery remain pending.
