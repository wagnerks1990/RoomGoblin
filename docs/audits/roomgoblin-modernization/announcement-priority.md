# Announcement and media priority ownership

Baseline: `ef7be2c88dedcb762a1b4915cc8d8f2a09af6c27`, the qualified audio retry
patch. Priority tracking is unchanged from checked main `955195a`.

## RG-ANN-006: Shared audio markers discarded another owner's priority

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement release / Audio priority ownership |
| Priority / confidence | P1 / Reproduced through actual release and observation functions |
| Baseline locations | `src/server.js:926-932,1153-1172,6688-6700,6752-6755,6851-6883` |
| Complexity / compatibility risk | Small / Process-local ownership; existing policy preserved |
| Expected benefit | Keep mandatory and recovered-media priority independent |
| State | Implemented; native qualification passed |

Announcements and ordinary audible media shared one target set. Release deleted
the recovered video's or manual takeover's marker. A media-ended message could
delete the active announcement's marker. Failed release also cleared runtime
targets, losing the evidence that made independent hallway targets mandatory.

A separate announcement target set now owns the mandatory hold. Ordinary
replacement commands and media-ended messages update ordinary media ownership;
they cannot remove the announcement hold. Successful release removes only its
hold after display reconciliation. Pending reconciliation keeps the mandatory
hold independently of active runtime target projection. Existing ordinary audio
policy, hallway independence and manual takeover behavior remain intact.

## Evidence and delivery boundary

Nine cases pass five controls and fail four cases on the exact baseline. They
execute the real release, priority and command-observation functions. All nine
pass with the fix, and the expanded focused suite passes 85 tests. One additional
Windows storage-mode check could not assert Linux directory permissions; the
native suite includes that unchanged check. No validation was weakened.

The first native run passed 1,338 tests with two skips but failed one Sports
fixture that asserted the former shared-set ownership. That fixture now executes
the actual separate-hold functions and still verifies mandatory announcement,
manual takeover, audible Sports and silent-replacement behavior; all 46 Sports
and priority focused tests pass. The final native active-worktree snapshot
passes 1,339 tests, zero failures and two root-only ownership skips (1,341 total),
plus all 23 Host Recovery tests and Node/controller/Python/Bash checks.

Checked integration, required CI, exact images and normal
backed-up delivery remain pending. No physical media or music command was used.
Release-clear failures, retry ownership across replacement announcements and
remaining Background Music lifecycle behavior remain under separate review.

## Verified combined delivery

PR #293 passed all 14 checks and merged at
`ac1ae4002adf3995d079836a13245e3e8449b636`. All five main workflows passed,
including exact image publication and Wiki synchronization. Its normal update
completed on 2026-10-28 at 01:12:28 UTC. The Hub runs that exact revision with
zero restarts; the unchanged maintenance container remains healthy.

Verification confirms clean main, healthy control/media/maintenance/Host Agent,
SQLite integrity, all eight encrypted secrets, database/ADB modes, authorization
boundaries, served assets and an empty selective update plan. Rollback to
`fe8b68a` and its images remains available.

Operational backup `auto-operational-2026-10-28T01-12-14-721Z.zip` is 128,669,737
bytes, mode 0600, SHA-256
`825119e81913d98f2d9a554295466ef9e69b23e043e4a07d5d5023291c098f9d`.
Archive CRC, canonical database-only membership and extracted SQLite integrity
passed. This receipt covers the monitor, configuration, audio-retry and separate
priority patches plus their security review. No physical commands, receiver
reloads or production fault injection were used.
