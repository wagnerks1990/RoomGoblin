# Scheduler Stop retention

Baseline: `52e28c6660e9258772f842f8df5eac4517d90a6a`, alpha.85, checked
PR #281 main. Status: locally qualified on checked PR #282 main; CI/delivery pending.

## RG-SCHED-018: Diagnostic history eviction could forget an accepted Stop

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler continuous recovery / Durable operator intent |
| Priority / confidence | P1 / Confirmed with actual ledger and recovery functions |
| Exact baseline locations | `src/automation-runtime.js:122-135`; `src/server.js:5860-5870` |
| Complexity / compatibility risk | Medium / Optional field in the existing version-1 preference |
| Expected benefit | History traffic cannot revive a stopped current occurrence |
| State | Reproduced, implemented and locally qualified |

A saved cancellation followed by 500 unrelated history rows disappears from the
bounded ledger. After restarting, continuous recovery admits that stopped current
winner. The actual ledger/recovery regression reproduced this on the baseline.
Legacy-row migration and claim-write retention also failed. The initial 11-case
suite additionally included new API and capacity contracts; all 11 failed before
implementation, which is not a claim that every case independently reproduced the
same old defect.

The same atomic preference write now includes `cancelledOccurrences`, independent
of the 500 diagnostic rows. It collects existing and newly appended cancellation
markers before truncating history. Continuous recovery reads one cancellation set
per pass. Public recent-history responses retain their existing shape. No SQLite
DDL, occurrence ID, command payload, authentication or dependency changes occur.

Retention follows real local dates, never the simulated scheduler clock. It keeps
yesterday (for overnight compatibility), today and future dated occurrences. Old
identities are removed on a later ledger write. Manual/noncanonical IDs continue
to use ordinary history because they are not scheduled recovery identities.
Retained identities are capped at 5,000 and one MiB of encoded UTF-8 JSON. Invalid
protected state or a full live budget fails closed. A rejected Stop save leaves
the entire selected run set unchanged. Duplicate markers consume no extra slot.
The existing 500-row maximum append batch remains enforced independently.

Legacy cancellation rows migrate on the next successful ledger write; no startup
rewrite is required. The optional field remains readable by the prior history
reader, but an older runtime can discard it on its next write. Downgrades therefore
restore the older bounded-history guarantee; this patch does not promise durable
Stop retention after a source rollback to an older implementation.

## Evidence and limits

The final focused suite passed **72 tests, 0 failed, 0 skipped**, including 15
retention cases. Fixtures use fresh JSON preference snapshots, injected write
failures, actual cancellation/recovery functions, history churn, restart, claim
writes, duplicate markers, real-date capacity cleanup, invalid dates/state and
the UTF-8 byte limit. The native active-worktree snapshot passed **1,151 tests:
1,149 passed, 0 failed, 2 root-only ownership skips**, plus **23 Host Recovery
tests**, Node/controller checks, Python compilation and tracked Bash syntax.
CI must also qualify Compose, runtime images/scans, browser coverage and native
artifacts. This result belongs to baseline PR #281 plus the retention patch.

Checked main `970cab330ffcf0e16585ac68a816a7697812e332` is now integrated.
The ledger/helper and documentation overlaps were inspected and both sets of
changes retained. Combined focused validation passed **116 tests**. A final full
snapshot is running; the preceding result is not claimed for this combined tree.

The final combined native snapshot passed **1,172 tests: 1,170 passed, 0 failed,
2 root-only ownership skips**, plus **23 Host Recovery tests**, Node/controller
checks, Python compilation and tracked Bash syntax. Only documentation status and
qualification text changed afterward. Final diff/whitespace review passed.

This closes retention only for continuous-run recovery. Current-state display/TV
reconciliation, action timing and the editor remain separate review items. No
physical command, receiver reload or production fault injection was used.
