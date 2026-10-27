# Complete occurrence ownership during recovery

Baseline: locally qualified resource patch
`c3fd0a49d44fcff96a5676b184b335ed609c02ca` on checked PR #284 main.
That resource patch is not yet merged. Status: implemented and locally qualified.
Checked integration with PR #285 and the resource patch remains a
separate requirement before PR submission.

## RG-SCHED-026: Partial ownership admitted an entire older loop

| Field | Assessment |
| --- | --- |
| Subsystem / category | Scheduler continuous recovery / Whole-occurrence admission |
| Priority / confidence | P1 / Confirmed across display, lighting and mixed domains |
| Exact baseline locations | `src/server.js:5863-5873,5874-5908,8584-8600` |
| Complexity / compatibility risk | Medium / Intentionally tightens recovery from any target to full scope |
| Expected benefit | Do not restart a whole loop against a newer winner's targets |
| State | Reproduced, implemented and locally qualified; checked integration pending |

Normal supersession cancels an entire older run when its resources overlap a new
occurrence. Recovery instead admitted any earlier loop that retained one winning
resource. An older two-device group could therefore restart its complete sequence
when a newer one-shot owned one member. Desired-state reconciliation initially
restored the right per-device state, but the recovered whole loop could overwrite
the newer winner. The same gap affected multi-display and mixed-domain loops.
A retained cancellation already prevented this; cold recovery without that marker
did not. The prior documentation explicitly described the any-resource rule.

Recovery now accumulates owned display, lighting and physical-TV resources for
each occurrence and requires its complete nonempty intended scope before
admission. The non-display selector retains the original occurrence separately
from each narrowed dispatch step, so legacy or multi-action intent is not lost.
Display content/overlay keys share a receiver ownership identity for this check;
explicit event-level timer targets are required even when outside the action
sequence. Delayed actions retain full ownership mode. Unopposed and independent
complete loops remain recoverable, and cancellation is still checked afterward.

This changes admission only. It does not split or rewrite saved sequences, create
new cancellation records, change dispatch payloads or replay rejected/uncertain
writes. Desired-state reconciliation can still restore the currently winning
pieces of a partially owned occurrence; its complete loop is not restarted.
Normal cancellation, replacement ordering, class windows, announcement priority
and dry/live command guards retain their existing boundaries.

## Evidence and limits

The first eight cases passed three controls and failed five regressions. Adding
explicit timer-scope cases produced **10 tests: 4 passed, 6 failed** on the
unchanged local resource baseline. All ten now pass using actual selectors,
resource expansion and continuous-recovery admission with fixture task adapters.
The cases cover lighting groups, multiple receivers, both directions of mixed
ownership, complete independent owners, pending replacement, saved Stop and
explicit timer targets.

The corrected focused suite passes **149 tests, zero failures, zero skips**.
Three older recovery fixtures now load actual resource-key calculation instead
of a placeholder key; their behavioral assertions are unchanged. The framework
source assertion requires explicit display ownership mode. An intermediate run
had 89 passes and eight fixture/source-call failures; it did not qualify the
patch. The corrected command verifies every named test file exists and includes
the actual ownership suite. The native active-worktree validation completed with
**1,220 tests: 1,218 passed, zero failed and two root-only ownership skips**, plus
**23 Host Recovery tests**. Node/controller validation, Python compilation and
tracked Bash syntax checks passed. Docker/image/platform/browser validation
remains assigned to the required CI workflows after checked integration.

This baseline contains a locally qualified parent patch that is still pending
checked integration, CI and delivery. No production test, physical classroom
command or receiver reload was used. No stored identity, schema, dependency or
version migration is needed. Later-pass reconstruction, cross-date resolution,
event-timer replacement resource policy and the editor remain separate audit
boundaries. This does not close the entire scheduler engine review.
