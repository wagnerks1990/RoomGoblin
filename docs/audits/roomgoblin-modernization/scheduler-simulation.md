# Scheduled sequence test-clock permission

Baseline: `5454b7b50687079560591402259b4a52ebcac7b8`, the locally qualified
scheduler timing/ownership head in PR #277, based on main `9c15339`.
Status: implemented and qualified locally; checked merge and delivery pending.

## RG-SCHED-008: Running sequences outlived test-clock live permission

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduled sequence engine / Safety and reliability |
| Priority / confidence | P1 / Confirmed by five failing execution regressions |
| Exact baseline locations | `src/server.js:1836-1856,1858-1874`; `src/automation-runtime.js:109-117` |
| Complexity / compatibility risk | Small / Low: existing scheduled-run permission |
| Expected benefit | Stop a sequence advancing after its test clock returns to dry mode |
| State | Reproduced, implemented and locally qualified; CI/delivery pending |

The scheduler checks test-clock live permission before starting a tick or recovering
an occurrence. Its running sequence checkpoints checked cancellation, shutdown,
pause, school suppression and saved revision, but did not check that permission.
A continuous sequence or delayed action could therefore keep advancing after
the bounded live window expired or an operator selected dry simulation.

The runner now uses the existing `SchedulerClock.commandsAllowed()` predicate at
every checkpoint and before admitting a timer overlay. Permission loss throws a
specific dry-run error through the existing owned-run error and ledger path.
The change preserves occurrence identity, current scheduler-clock calculations,
monotonic waits, manual execution and shutdown interruption semantics.

Seven new regressions execute the actual sequence runner with the real
`SchedulerClock` permission implementation. Five fail on the baseline: initial
dry admission, expiry during a pre-action wait, expiry during dwell/cycle waits,
switching to dry mode between actions, and expiry before a final overlay. Manual
runs and unexpired-live/real-time controls pass before and after the fix. Combined
timing, ownership, TV sequence and TV recovery fixtures pass all **91 tests**.

## Boundary and remaining review

This is an action-admission checkpoint change. Already accepted adapter work may
finish; the change does not undo hardware effects or introduce transport aborts.
Direct reconciliation, announcement recovery, legacy-tick continuation and
multi-command adapter boundaries require their own review. This report does not
claim that every simulation-sensitive path has been audited. No physical device
command or production fault injection was performed.

The sequence runner and its checkpoint/overlay paths were fully read along with
`SchedulerClock`, the test-clock API/UI state and relevant framework documentation.
The full active-worktree native Linux snapshot passed **1,078 tests: 1,076 passed,
0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**. Node and
controller checks, Host Python compilation and tracked Bash syntax passed. The
checked squash merge of PR #277 has the same tree as the reviewed baseline; this
patch was reapplied on that main commit without changing runtime or test content.
Docker is unavailable locally, so CI must qualify Compose, images and artifacts.
The remaining scheduler engine/editor review stays open. CI, checked merge, Wiki
sync, exact-image publication and the normal backed-up update are pending.


This change is included in the consolidated PR #278. Its final combined snapshot
passed 1,110 tests with zero failures and two root-only skips (1,112 total), plus
23 Host Recovery tests and syntax checks. See the validation record; fresh CI,
checked merge and delivery remain pending.
