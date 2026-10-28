# Deferred announcement bookkeeping

Baseline: `af08a26dcc72dc946ba11ff9d472028da36f687b`, the qualified combined
probe/Music patch. Deferred bookkeeping is unchanged from main `ac1ae40`.

## RG-ANN-008: Storage errors discarded deferred occurrences before retry

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement release / Persistence and retry ownership |
| Priority / confidence | P1 / Reproduced through actual bookkeeping and retry functions |
| Baseline locations | `src/server.js:1104-1117,1148-1165` |
| Complexity / compatibility risk | Small / Existing occurrence markers and synchronous persistence |
| Expected benefit | Keep failed bookkeeping recoverable without replaying old commands |
| State | Implemented; native qualification passed |

Consumption cleared the deferred queue and changed execution markers before
persistence. A write failure left no queued records for retry and left memory
ahead of the database. The release retry did not attempt bookkeeping at all.

The queue is now consumed after persistence succeeds. A failed write restores
the original marker values and absent fields while preserving event identities
and alias-map references. A replacement queued during persistence is retained.
Release retry consumes remaining bookkeeping before resynchronizing current
winners or releasing music. It never executes the old deferred commands.

Six cases execute the real functions: four fail on baseline and two controls
pass. All six pass with the fix, and the expanded announcement/recovery suite
passes 73 tests. Coverage includes multiple occurrence keys, existing/absent
markers, write failure and retry, a replacement queue entry, and music remaining
held until retry bookkeeping succeeds.

The native active-worktree snapshot passes 1,371 tests, zero failures and two
root-only ownership skips (1,373 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact
images and backed-up delivery remain pending. Separate reproduced release-clear and successor-hold
defects remain open. No production fault or physical command was used.
