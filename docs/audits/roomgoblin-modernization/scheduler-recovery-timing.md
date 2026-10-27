# TV and lighting recovery timing

Baseline: `970cab330ffcf0e16585ac68a816a7697812e332`, alpha.85, checked
PR #282 main. Status: locally qualified on checked PR #283 main; CI/delivery pending.

## RG-SCHED-019: Recovery admitted actions before configured delays elapsed

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler non-display recovery / Timing correctness |
| Priority / confidence | P1 / Confirmed through actual recovery and command handling |
| Exact baseline locations | `src/server.js:5771-5807`, especially `5784-5788` |
| Complexity / compatibility risk | Small / Low: first-pass eligibility calculation |
| Expected benefit | Resume/startup does not apply a future TV or lighting step early |
| State | Reproduced, implemented and locally qualified |

Recovery counted pre-action delays but omitted preceding action dwell times, then
rounded eligibility down to whole minutes. A 59-second delay could execute one
second after the occurrence began. A display action's dwell did not postpone a
following TV action. Recovery now includes every preceding first-pass dwell and
compares exact elapsed seconds, including fractional seconds, before admitting a
TV/lighting candidate. Example: a 30-second pre-delay, 60-second dwell and following
10-second pre-delay make the second action eligible at 10:01:40 for a 10:00 start.

## RG-SCHED-020: Equal-time recovery kept an earlier action's state

| Field | Assessment |
| --- | --- |
| Subsystem / category | Recovery winner selection / Canonical sequence order |
| Priority / confidence | P1 / Confirmed by emitted TV command |
| Exact baseline locations | `src/server.js:5798-5801` |
| Complexity / compatibility risk | Small / Low: tie only within the same occurrence |
| Expected benefit | Later eligible actions supersede earlier state on the same target |
| State | Reproduced, implemented and locally qualified |

Two eligible steps in one occurrence shared minute, priority and event identity,
so the first candidate always won. An On followed by Off could restore On even
after both steps were due. Equal-score steps now follow canonical action order
within the same event/class/time occurrence. Minute, priority and event-ID
precedence between separate occurrences remains unchanged. TV aggregate intent,
typed transports, physical announcement locks and no-retry behavior are retained.

## RG-SCHED-021: Action eligibility was also used as restart ownership

| Field | Assessment |
| --- | --- |
| Subsystem / category | Continuous recovery / Pending sequence ownership |
| Priority / confidence | P1 / Confirmed by executable admission cases |
| Exact baseline locations | `src/server.js:5771-5807,5851-5860` at checked `22b19dce3078ccfb3c058f6db0d27b7851588e97` |
| Complexity / compatibility risk | Medium / Explicit internal ownership mode |
| Expected benefit | Recover a delayed current owner without restarting an older loop |
| State | Reproduced, implemented and locally qualified |

Continuous recovery reused the state-projection winners. A pending first action
could therefore hide its current sequence owner and allow an older loop to restart.
Adding accurate dwell timing also exposed a later action in an older occurrence
displacing a newer owner. These are distinct questions: which command is due now,
and which started occurrence owns the intended resource.

The existing helper now has an explicit internal ownership mode, used only for
continuous-run admission. It includes pending steps of already-started occurrences
and ranks them by occurrence start, then the existing priority/event-ID order.
Action-state projection retains exact eligibility and effective-minute ranking.
Cancellation is checked after winner selection, so a stopped pending winner cannot
revive a superseded predecessor. Class/window checks, the actual owned runner,
delays and cancellation remain unchanged. No command is issued by winner selection.

Five added fixtures execute actual winner selection and recovery admission. On
checked main, three ownership cases failed; the combined sub-minute state/admission
case also failed because of early dispatch, and the older-step ownership control
passed. All five failed on the partial timing correction before ownership was
separated. A preliminary incorrectly nested loop fixture was corrected before
those baseline runs and is not counted as defect evidence. The corrected focused
suite passed **187 tests**. One old source-call assertion was updated to require
the explicit ownership mode; executable cases verify the behavior.

## Qualification history and limits

The initial four-case probe failed three cases and passed its exact-boundary
control. Ten executable command-path regressions then failed six cases and passed
four controls against the baseline. The initial 11-case file added lighting coverage.
It executes actual winner selection, dispatch planning, reconciliation and the
TV/Govee single-action handler with fixture adapters. The focused run passed
**117 tests**, including existing aggregate, announcement, permission and cycle
coverage. The full native active-worktree snapshot passed **1,168 tests: 1,166
passed, 0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**,
Node/controller checks, Python compilation and tracked Bash syntax. Final diff
and whitespace review passed. Only documentation qualification text changed
afterward. CI must qualify images/scans, Compose, browser and native artifacts
before merge/publication. This result belongs to PR #282 main plus this patch;
checked retention integration will be qualified separately when available.

This calculation describes configured first-pass eligibility. It does not infer
elapsed adapter latency, replay uncertain writes or reconstruct later loop phases.
Display resync, later-pass recovery, cross-date resolution and the editor remain
separate review items. No SQLite schema, API, payload, stored ID, dependency or
version change occurs. No physical command or production fault injection was used.

Checked main `22b19dce3078ccfb3c058f6db0d27b7851588e97` is now integrated,
including the complete Stop-retention implementation and 15 new regressions.
Two documentation conflicts were inspected and both changes retained; runtime
merged without conflicts. The combined focused suite passed **156 tests**.
A fresh full native snapshot is running for this combined source.

That pre-admission combined snapshot passed **1,183 tests: 1,181 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests** and syntax checks.
It does not qualify the subsequent ownership correction. A fresh full snapshot
including all 16 timing/admission fixtures is running.

The final combined snapshot including the ownership correction passed **1,188
tests: 1,186 passed, 0 failed, 2 root-only ownership skips**, plus **23 Host Recovery
tests**, Node/controller checks, Python compilation and tracked Bash syntax.
Only documentation status/qualification text changed afterward. Final diff and
whitespace review passed. Fresh CI/publication and appliance delivery remain gates.


All 14 PR checks passed before squash merge in PR #284 at
`2bd5ce972dca231d5aeb8eff42a57245cec8fee6`. The checked branch was current with
main and had no unresolved review threads. Main validation, exact image
publication and backed-up appliance delivery are pending; merged source alone
is not an installable release.
