# Automation cancellation persistence

Baseline: `e3f93c4f5755784e1950d41a1b6cadb0c1e31114`, alpha.85, the
qualified PR #278 head. Checked main `66c54a2b321675905472ea992b88b0f0319ab8fa`
has the identical tree. Status: validated, merged and deployed in PR #281; receipt below.

## RG-SCHED-014: Cancellation writes could partially change execution

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler cancellation / Persistence and reliability |
| Priority / confidence | P1 / Confirmed by injected persistence failures |
| Exact baseline locations | `src/server.js:5912,6711-6715,8563-8617`; `src/automation-runtime.js:122-128` |
| Complexity / compatibility risk | Medium / Low: one existing preference upsert |
| Expected benefit | Failed cancellation saves leave all selected runs unchanged |
| State | Validated, merged and deployed; receipt below |

The operator Stop callback and four bulk helpers changed cancellation flags before
writing each ledger row. A failed first save could stop a run despite reporting
failure; a later save failure could leave a partially persisted and partially
cancelled selection. The shared request helper now saves the entire selection in
one ledger write, then applies all in-memory flags. No asynchronous gap is added.
The existing synchronous SQLite preference upsert owns atomic persistence.

The ledger gains a bounded batch append while retaining single-record and claim
behavior. Empty batches do not write. A batch exceeding the existing 500-row
history capacity fails before any write or cancellation, so its own newly accepted
markers cannot be silently discarded. Metadata, audits, manual selection and
accepted-task waits remain intact. The manual-media helper is covered; its caller's
separate priority and scheduler-pause changes are not claimed atomic here.

## RG-SCHED-015: Restart recovery could ignore an accepted Stop request

| Field | Assessment |
| --- | --- |
| Subsystem / category | Continuous recovery / Operator intent |
| Priority / confidence | P1 / Confirmed by three failing recovery cases |
| Exact baseline locations | `src/server.js:5867-5870` |
| Complexity / compatibility risk | Small / Low: retained occurrence history only |
| Expected benefit | A restart before the cancellation checkpoint respects saved Stop |
| State | Validated, merged and deployed; receipt below |

Recovery excluded only a latest `cancelled` row. An already saved
`cancel-requested` row did not prevent recovery, and a later running/interrupted
diagnostic row could hide it. Recovery now excludes an occurrence with either
retained cancellation marker. Unrelated occurrences and shutdown interruption
without cancellation remain recoverable under the same current-winner rules.

## Evidence and limits

All five cancellation paths, their callers, owner cleanup, recovery admission,
ledger implementation and SQLite preference access were read. The 24 executable
fixtures exercise actual server functions/operator callback and the actual ledger;
the store returns fresh JSON snapshots like SQLite and injects write failures.
Baseline results: **6 passed, 18 failed**. Corrected focused cancellation, ownership,
resource and runtime suites: **60 passed, 0 failed**; including the updated framework
contract suite, **70 passed, 0 failed**. HTTP authentication is not
retested by callback fixtures; the existing route guards are unchanged. The first
native full run passed 1,132, failed two obsolete source-pattern assertions and
skipped two root-only cases (1,136 total). A second snapshot included only the
first assertion correction: 1,133 passed, one failed, two skipped. Both assertions
now follow the shared cancellation boundary and retained-history predicate; a
fresh full run is required. These intermediate runs are not successful qualification.

The final native active-worktree snapshot passed **1,136 tests: 1,134 passed,
0 failed, 2 root-only ownership skips**, plus **23 Host Recovery tests**.
Node/controller checks, Host Python compilation and tracked Bash syntax passed.
The final diff and whitespace checks passed. Docker is unavailable locally; CI
must qualify Compose, images/scans, browser coverage and native artifacts.

The 500-row ledger can later evict an old cancellation marker. This patch preserves
that existing retention policy and does not claim indefinite cancellation memory.
Retention under sustained history traffic is addressed by the separate
[Stop-retention follow-up](scheduler-stop-retention.md). Current-winner reconciliation outside continuous recovery, recovery action
timing and remaining simulation dispatch boundaries also remain open. No physical
command or production fault injection was used. The checked merge and delivery
receipt below supersede the earlier qualification-stage status.

## Checked merge

PR #281 passed all 14 checks and merged as
`52e28c6660e9258772f842f8df5eac4517d90a6a`, with the same tree as its qualified
head. Main validation, Wiki sync, exact images and backed-up delivery subsequently
passed as recorded below. The dispatch-permission branch preserves this entire implementation
and all 24 cancellation regressions during integration.

## Appliance delivery closure (2026-10-27 UTC)

PR #281 passed all 14 PR checks and all five main workflows, including Wiki sync
and exact image publication. The normal backed-up update completed at 08:12:33 UTC
on clean main and Hub image `52e28c6660e9258772f842f8df5eac4517d90a6a`.
The existing maintenance container at `20f8c501916f34e17bee2c643434e7cce0c919e6`
was retained; both containers are healthy with zero restarts. Control/media health,
readiness, canonical SQLite, eight secret decryptions, DB/ADB permissions,
authentication boundaries, served operator assets and deployment inputs passed.
The backup passed journal checksum, ZIP CRC, canonical-only database and extracted
SQLite checks. Rollback to `66c54a2b321675905472ea992b88b0f0319ab8fa` remains
available. PR #281 records the archive name, size and SHA-256. No physical classroom
command, receiver reload or production fault injection was issued.
