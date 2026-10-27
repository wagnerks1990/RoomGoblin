# Automation replacement dispatch ordering

Baseline: `70ad1c8e6dbcf2e824746d25af8142dc88c363ea`, alpha.85.
Status: implemented and qualified locally; integration into PR #278 pending.

## RG-SCHED-012: Replacement dispatch raced older accepted adapter work

| Field | Assessment |
| --- | --- |
| Subsystem / category | Automation task admission / Reliability and ordering |
| Priority / confidence | P1 / Confirmed by six failing ownership regressions |
| Exact baseline locations | `src/server.js:8513-8527,8528-8541`; scheduled/recovered/manual owner callers |
| Complexity / compatibility risk | Medium / Medium: overlapping work now waits for settlement |
| Expected benefit | Keep a late older adapter completion from overwriting replacement state |
| State | Reproduced and locally qualified; combined CI/delivery pending |

Supersession marked older runs cancelled, but the new owner immediately executed
its action. Cancellation checkpoints cannot undo a request already accepted by
an adapter. That request could therefore finish after the replacement dispatched.

The shared owner now captures prior overlapping tasks before registering itself.
Its accepted, drain-tracked task waits for those predecessors to settle before
execution. Discovery returns normally and disjoint resources proceed. Registration
before waiting lets a third run cancel an already waiting replacement. Rejected
predecessors are settled without transferring their failure to the successor.
Existing error reporting, ledger behavior and unconditional cleanup are retained.

Fixtures execute the actual owner, tick, recovery, manual admission and ledger.
Six baseline failures cover scheduled/recovered/manual replacement, a failed
predecessor, successive replacements and shutdown while waiting. The disjoint
resource control passes on both versions. The accepted writer counter includes
both predecessor and waiting replacement, while the scheduler discovery flag is
released. Adapters are controlled; no live device is contacted.

## RG-SCHED-013: Expired class windows skipped the initial cancellation check

| Field | Assessment |
| --- | --- |
| Subsystem / category | Sequence entry and overlays / Reliability |
| Priority / confidence | P2 / Confirmed by cancelled/interrupted entry regression |
| Exact baseline locations | `src/server.js:1893-1908,1999` |
| Complexity / compatibility risk | Small / Low: existing lifecycle predicate |
| Expected benefit | Prevent a cancelled waiting run from emitting a final overlay |
| State | Reproduced and locally qualified; combined CI/delivery pending |

The sequence checked the class window before its first cancellation checkpoint.
If a waiting replacement reached execution after the class ended, it could skip
the action loop and still reach the final overlay. Entry now checks the existing
run-active predicate first, preserving cancellation and shutdown interruption
through the normal ledger path. The actual runner fixture verifies both outcomes
produce no action or overlay.

## Scope and qualification

The owner, all three admission paths, sequence entry and existing cancellation
helpers were fully read, with the lifecycle and framework contracts. Eight new
regressions include seven baseline failures and one disjoint-work control. The
corrected combined ownership, cycle, manual and TV sequence/recovery suite passes
**102 tests**. The full active-worktree native Linux snapshot passed **1,079 tests:
1,077 passed, 0 failed, 2 root-only ownership skips**, plus **23 Host Recovery
tests**, Node/controller checks, Host Python compilation and tracked Bash syntax.
Docker is unavailable locally; CI owns Compose, image builds/scans and native
artifacts. Combined qualification is required after integration into PR #278.

Resource matching uses existing resource keys; the separately reviewed identity
correction is in PR #280. This patch does not alter keys or recovery winner timing.
An unresolved predecessor deliberately retains ownership and blocks overlapping
dispatch; it does not block scheduler discovery or extend the existing shutdown/
Full Recovery failure deadline. Cancellation-persistence failures are a separate
open review item. No schema, device identity, API, command payload or dependency
change is required. Checked merge, Wiki sync, exact images and the normal backed-up
update remain pending.
