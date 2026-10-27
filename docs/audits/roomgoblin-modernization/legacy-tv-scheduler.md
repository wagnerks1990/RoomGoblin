# Legacy TV scheduler review

Baseline: `9c15339776e6193b2002a1fccbd0c1e7cbd6f37a`, alpha.85.
Status: validated, merged and delivered in PR #278 on 2026-10-27 UTC.

## Inspection boundary

Fully inspected the legacy timer/dispatch owner at `src/server.js:8633-8659`,
its schedule initialization/persistence at `550-563`, and the shared physical
lock helper at `1625-1637`. Reviewed the canonical TV-power dispatch and the
application writer-drain dependency. This is a focused continuation of scheduler
review after the timing/ownership patch in PR #277, not closure of the whole
engine, editor, lighting or announcement subsystem.

## RG-SCHED-005: Legacy power ignored some physical announcement locks

| Field | Assessment |
| --- | --- |
| Subsystem / category | Legacy per-output TV scheduling / Priority and compatibility |
| Priority / confidence | P1 / Confirmed by four failing dispatch regressions |
| Exact baseline locations | `src/server.js:8649-8650`; shared helper `1625-1637` |
| Complexity / compatibility risk | Small / Medium: physical output reservation |
| Expected benefit | Prevent legacy schedules from powering announcement-owned TVs |
| State | Reproduced, validated and delivered in PR #278 |

The timer selected the first receiver whose mapping matched the output, then
checked that receiver alone. An unlocked alias could hide another locked receiver
on the same physical output. Unknown named mappings also failed to reserve power.
This differed from the canonical TV-power contract already used by action runs.

The legacy path now asks the existing physical-lock helper about every locked
receiver immediately before each output's claim/write. Known ports protect both
transports; missing/invalid named mappings fail closed. It preserves the saved
HDMI/HDBT connection and never broadens a command into an aggregate broadcast.
Deferred work is not claimed as sent. The next eligible tick may send it only
after the lock clears and while its original exact minute is still due.

Fixtures reproduce a hidden alias, unknown named mapping, both transports sharing
a port and a lock acquired between two writes. Unrelated unlocked outputs retain
their exact command and connection. No live receiver or matrix is contacted.

## RG-SCHED-006: Claims were saved after hardware dispatch

| Field | Assessment |
| --- | --- |
| Subsystem / category | Legacy occurrence persistence / Reliability |
| Priority / confidence | P2 / Confirmed by before-send persistence regression |
| Exact baseline locations | `src/server.js:8651-8657` |
| Complexity / compatibility risk | Medium / Medium: durable admission and uncertain outcomes |
| Expected benefit | Avoid replaying an uncertain CEC command after restart |
| State | Reproduced, validated and delivered in PR #278 |

`lastExec` changed only in memory before dispatch, and the whole schedule store
was saved after the loop. A restart between dispatch and that save could find the
same exact-minute occurrence still eligible. A failed claim persistence was also
discovered only after the physical request had already been made.

The exact-minute claim and an explicitly unconfirmed outcome now persist before
CEC dispatch. If this admission save throws, no command is sent; the in-memory
claim/result are restored so a later due tick can safely retry the unsent admission.
After dispatch begins, neither command failure nor a failed final status save
removes the durable claim. A recreated scheduler using the before-send snapshot
must skip that occurrence. An unconfirmed outcome needs operator verification;
it is not evidence of physical power state and is never automatically replayed.

Tests inspect the real persistence ordering, restart from the captured snapshot,
reject admission saves and recover a later unsent admission, and fail the final
save after uncertain delivery. Rejected and unverified adapter replies remain
failures with one write, including on subsequent ticks.

## RG-SCHED-007: Persistence errors escaped the asynchronous timer

| Field | Assessment |
| --- | --- |
| Subsystem / category | Legacy timer ownership / Reliability and diagnostics |
| Priority / confidence | P2 / Confirmed by rejected timer fixture |
| Exact baseline locations | `src/server.js:8636-8659` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Report storage failure without an unhandled timer rejection |
| State | Reproduced, validated and delivered in PR #278 |

The asynchronous interval callback had a finalizer but no outer error handler.
Persistence errors rejected its ignored promise. The named tick now records those
errors inside its busy ownership, then releases the busy flag in the finalizer.
Its interval and supported eligibility checks stay unchanged. The fixture executes
the actual application writer-drain predicate: an accepted held write prevents
drain and overlapping ticks until it settles; afterward the drain can complete.

## Qualification boundary

Seven of eleven original legacy fixtures fail on the baseline; four existing
behavior controls pass. The corrected final focused run passes all **91 tests**:
legacy timer, canonical TV-power sequence/recovery and bounded Pluto transport.
The suite includes no physical network action. The full active-worktree Linux
snapshot passed **1,064 tests: 1,062 passed, 0 failed, 2 root-only ownership skips**,
plus **23 Host Recovery tests**. Node/controller checks, Host Python compilation
and tracked Bash syntax passed. Docker is unavailable locally; CI must qualify
Compose, image builds/scans and platform artifacts. CI, checked merge, Wiki sync,
exact image publication and normal backed-up update are pending.
The rest of scheduler/editor review remains open.

After integrating checked scheduler merge `70ad1c8`, the combined actual worktree
passed **136 native focused tests**, 23 Host Recovery tests and syntax checks.
The source merged without overlap; documentation overlaps retained both contracts
and their qualification records. Fresh CI must validate this combined PR head.


This change is included in the consolidated PR #278. Its final combined snapshot
passed 1,110 tests with zero failures and two root-only skips (1,112 total), plus
23 Host Recovery tests and syntax checks. See the validation record; fresh CI,
checked merge and delivery remain pending.

## Delivery closure

PR #278 passed all 14 PR checks and all five main workflows. The normal backed-up
update completed at 07:45:03 UTC on clean main and Hub image
`66c54a2b321675905472ea992b88b0f0319ab8fa`. Maintenance remained healthy at
`20f8c501916f34e17bee2c643434e7cce0c919e6`. Runtime health, database/secret integrity,
permissions, authentication, source/deployment inputs, served assets, backup
integrity and rollback passed. No physical command or receiver reload was issued.
Earlier pending statements describe their qualification stage; this closure is
the current delivery status. See [validation evidence](validation.md).
