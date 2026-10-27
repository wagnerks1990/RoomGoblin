# Automation editor dates and preview responses

## Verified delivery

All 14 PR checks passed before squash merge at `3978311d9a6c0348db5947c974c98079a16814b8`. Main validation, browser regression, security, Wiki sync and exact image publication passed. The normal selective Hub update completed on 2026-10-27 at 10:24:35 UTC. Read-only appliance verification confirmed clean main, the exact Hub revision, healthy control/media/maintenance/Host Agent endpoints, canonical SQLite integrity, all eight encrypted secrets, database/ADB permissions and expected authorization responses. Maintenance remained unchanged and healthy. Backup `auto-operational-2026-10-27T10-24-21-745Z.zip` (128,567,842 bytes, mode 0600) matched journal SHA-256 `636c160d73da6891ed9b616ef3b376699c1e59a0cd576bfcfd0952dec7c571b2` and passed ZIP CRC, canonical-database-only and extracted SQLite checks. Rollback to `065e32e` remains available. Served automation/planning/controller/setup assets matched merged source. No physical commands, receiver reloads or production fault injection were used.

Baseline: checked main `217588afddcaf445d1fa9a2dd684dde088c82c7a`, alpha.85.
Status: all gates passed; deployed and verified at `3978311` (PR #287). The patch was
integrated with checked resource/ownership main `065e32e73b8c9c84068d2feb8a9760f4a8f4b4a8`
(PR #286). Both documentation conflicts retained the editor and recovery changes.

## RG-AUTO-EDIT-001: Today only reused the first loaded date

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation editor / Calendar state |
| Priority / confidence | P2 / Confirmed in two browser reproductions |
| Exact baseline locations | `public/controller/automation-studio.js:43,73` |
| Complexity / compatibility risk | Small / Read-only date lookup; drafts and server validation preserved |
| Expected benefit | Today only selects the current appliance date in long-lived controllers |
| State | Reproduced, implemented and locally qualified |

The controller fetched its planning date only once. Reloading schedules after
midnight did not update the cached value, and an editor left open across midnight
also kept it. Both browser reproductions expected October 19 and received October
18 on unchanged main. Today only could therefore save a temporary routine for
the wrong date.

Schedule loads now refresh their planning date. Today only independently reads
the existing automation-clock status and derives the date in its explicit
appliance timezone, including a simulated scheduler date. It does not require
a full Planning read, change endpoint permissions or relax the existing
`schedule.manage` plus `automation.manage` navigation boundary. It disables repeated
lookup/preview admission while pending and invalidates the previous review.
Failed or invalid responses preserve the existing fields and show an error.
Manual date changes made during the request take precedence; a closed dialog
does not receive the result. This does not use the operator computer's timezone
to choose the date or silently save the draft.

## RG-AUTO-EDIT-002: Obsolete preview responses replaced current review state

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation editor / Asynchronous draft review |
| Priority / confidence | P2 / Confirmed by response-order browser cases |
| Exact baseline locations | `public/controller/automation-studio.js:102-105,160-162` |
| Complexity / compatibility risk | Small / Existing exact-draft and backend validation retained |
| Expected benefit | Save availability and status describe the currently reviewed draft |
| State | Reproduced, implemented and locally qualified |

An old successful preview could re-enable Save and announce readiness after the
draft changed. The existing save-time JSON comparison still rejected that stale
draft; this is not evidence of an authorization or backend validation bypass.
Conversely, an old failing preview arriving after a newer successful one disabled
Save and discarded the valid review. Both response-order cases failed when the
browser fixture served the exact baseline script. The shared-layer editor had
the same two failures against its unchanged baseline implementation.

Each preview and edit now advances a dialog-local generation. Only the current
generation in an open dialog may update review state, and successful responses
must still match the current draft. The existing save-time JSON comparison and
server-side conflict checks remain. Shared-layer preview uses the same dialog
generation rule, preserves its server hash and clears obsolete match results
when edited. Preview and Save issue no device commands.

## Evidence and remaining review

Nine new browser tests cover the two midnight paths, unavailable and invalid
planning dates, manual edits during a held lookup, edited-draft preview results
and out-of-order preview failures. The timezone case crosses UTC midnight and
keeps the appliance date while Planning is unavailable. The focused set, including
the existing mobile temporary-timer workflow, passed **8 tests in Chromium and
8 in Firefox**, with zero failures or skips. The unavailable-date test includes
failed requests, invalid timestamps and invalid timezones.
The six original defect reproductions all failed against their baseline implementations.
Controller syntax/runtime-symbol checks and browser-test Python compilation pass.

The initial broad invocation could not import the repository through Python's
standard-library `test` package; a direct file invocation did not execute tests.
Neither is counted as passing validation. The corrected explicit module loader
executed the tests reported above. Native WSL Git cannot resolve the
Windows worktree pointer, so the baseline script was exported with Windows Git
and served unchanged by the browser fixture; no tracked source was swapped.

Required CI and delivery remain. Other editor controls,
save-request ownership and accessibility remain under
review. Cross-date/class-end scheduler semantics belong to the linked planning
review; later loop phase is still an explicit first-pass recovery limit. This
does not close the entire scheduler/editor unit or the modernization roadmap.


The initial Planning-endpoint implementation passed all **39 workspace browser
tests** and a native snapshot with **1,205 tests: 1,203 passed, zero failed and
two root-only ownership skips**, plus **23 Host Recovery tests** and syntax
checks. Those results precede the smaller clock-status lookup and do not qualify
its final integration. A capability experiment correctly hid the page without
`schedule.manage`; that navigation requirement was retained, and the test now
checks an authorized editor with Planning unavailable.

The clock-status correction passed all **40 workspace browser tests**, zero
failures or skips, before the shared-layer fix. The combined preview fixes pass
**10 focused tests in both Chromium and Firefox**. The final combined tree passed
all **42 workspace Chromium tests** and **37 focused Node tests**, with no failures
or skips. The native active-worktree Linux helper passed **1,237 tests: 1,235
passed, zero failed and two root-only ownership skips**, plus **23 Host Recovery
tests**, Node/controller checks, Python compilation and tracked Bash syntax.
Docker image/Compose, security and platform checks are delegated to required CI
because Docker is unavailable locally. No physical commands, receiver
reloads, production fault injection, schema or identity changes are involved.
