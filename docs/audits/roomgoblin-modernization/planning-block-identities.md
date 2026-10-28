# Timetable occurrence identity and class references

Baseline: `ac09411902bcec3363cf60a0e8a8cb4b07d6abe1`, the locally qualified
class-boundary patch on PR #290. The final qualified tree is integrated unchanged
on checked main `955195af5a0077e823f075def12440a81db4f141` after PR #290.
A complete tree comparison against `4405c73` confirms identical implementation,
tests and documents before recording this integration receipt.

## RG-PLAN-004: Simultaneous timetable blocks shared execution identities

| Field | Assessment |
| --- | --- |
| Subsystem / category | Planning and scheduler / Occurrence identity |
| Priority / confidence | P1 / Reproduced in actual tick and recovery selectors |
| Baseline locations | `src/automation-runtime.js:141,213`; `src/server.js:942,1019,5897,5942,8722` |
| Complexity / compatibility risk | Medium / Runtime key change with legacy admission guards |
| Expected benefit | Keep distinct block runs and Stops from collapsing into one |
| State | Implemented; final native qualification passed |

Two blocks selected by one automation at the same time shared the `manual`
occurrence key. The tick admitted only the first. Recovery could combine distinct
owners or choose a different block than the live supersession order. Runtime keys
now include `block:<blockId>` throughout admission, announcement deferral, display
reconciliation and continuous ownership. Equal-time, equal-priority display block
winners follow the final live block, as lighting recovery already did.

Ordinary class/clock identities stay byte-for-byte unchanged. Old manual markers
and claimed/running/succeeded history deny uncertain replay. An old retained Stop
or cancellation row protects all formerly ambiguous blocks at that event/date/time.
The ledger also denies an ordinary fresh claim for a retained Stop after history
eviction. New block Stops are independent. Bounds, real-date retention, atomic
persistence and public history shape are unchanged. Existing keys/history are
not rewritten. Rollback restores the matching pre-update source/database snapshot.

## RG-PLAN-005: Class deletion could orphan timetable blocks

| Field | Assessment |
| --- | --- |
| Subsystem / category | Class schedules / Referential integrity |
| Priority / confidence | P2 / Reproduced with the actual delete handler |
| Baseline locations | `src/server.js:5649-5655,5696-5721,5784-5792` |
| Complexity / compatibility risk | Small / Extends the existing 409 reference guard |
| Expected benefit | Keep saved timetable references valid when deleting a class |
| State | Implemented; final native qualification passed |

Class deletion checked automations, timers and continuations but omitted saved
timetables. It now reports each referencing timetable once and rejects deletion
even when Planning is disabled. Removing references permits deletion. No block,
class identity or existing orphan is silently repaired. The current editor can
show unavailable saved classes for explicit repair.

The final API review also reproduced acceptance of a draft naming a nonexistent
class. Preview and Save now reject it with the timetable and missing class ID.
Save checks the existing revision/hash first, so removing a class after Preview
still returns the established 409 stale-review response. Disabled saved classes
and period-only blocks remain valid. Four API cases initially passed two controls
and failed two cases; all four now pass. Existing orphaned references remain
readable and require explicit repair before saving the affected plan.

## Evidence and limits

The initial 12 block cases passed seven controls and failed five cases on the
baseline. Five class-reference cases passed three controls and failed two.
All 17 pass with the implementation. Eight additional cases cover historical
cancellation rows, independent block Stops, ordinary retained-Stop admission,
alias scope, persistence failure and real-date block retention.

The expanded Windows suite has 335 passes, zero failures and nine Linux-only
lifecycle skips (344 total). Three VM fixtures now import the real occurrence-key
helper; behavioral assertions remain intact. One existing source assertion now
expects both current and legacy Stop checks. The final native active-worktree
snapshot passes 1,283 tests, zero failures and two root-only ownership skips
(1,285 total), plus all 23 Host Recovery tests and Node/controller/Python/Bash
checks. This includes all 29 new block/reference cases and the 19 class-boundary
cases. Docker/Compose, platform and security validation remains with required CI
because Docker is unavailable locally. Checked merge, exact images and backed-up
appliance delivery remain pending.
No physical commands, receiver reloads, live timetable edits or production fault
injection were used. Offset dates in operator previews and later scheduler
loop-phase recovery remain open; this is not completion of the modernization roadmap.

Delivery verified 2026-10-27 UTC at `407be9eb2ce6495721164cf6dc00a68c2a111bc1` after all 14 PR checks, checked squash merge, main gates and exact image publication. The normal updater completed at 2026-10-27T11:44:33.269559+00:00. Clean main, the exact Hub revision and served operator assets, both service health endpoints, canonical SQLite integrity and eight encrypted secret rows passed. Maintenance retained its verified container at `20f8c501916f34e17bee2c643434e7cce0c919e6`; both containers report zero restarts. Backup `auto-operational-2026-10-27T11-44-19-480Z.zip` is 128614168 bytes, mode 0600, SHA-256 `7898df3ac7ba93a18c6f0859a2367ce17c14c6382583e2e6eb2fa859f11495f0`; journal checksum, archive CRC, canonical-database-only contents and extracted SQLite integrity passed. Previous deployment `955195af5a0077e823f075def12440a81db4f141` and its images remain available for rollback. No physical commands, receiver reloads, live timetable edits or production fault injection were used.
