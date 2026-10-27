# TV and lighting recovery timing

Baseline: `970cab330ffcf0e16585ac68a816a7697812e332`, alpha.85, checked
PR #282 main. Status: locally qualified; checked-main integration and CI pending.

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

## Evidence and limits

The initial four-case probe failed three cases and passed its exact-boundary
control. Ten executable command-path regressions then failed six cases and passed
four controls against the baseline. The final 11-case file adds lighting coverage.
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
