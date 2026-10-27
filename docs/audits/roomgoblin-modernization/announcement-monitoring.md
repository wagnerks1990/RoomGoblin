# Announcement monitor ownership and offline evidence

Baseline: `9ae4496aad96ce46355f05e9621099da5889014b`, the qualified Planning
preview patch. Announcement functions are unchanged from checked main `955195a`.

## RG-ANN-001: Settings restarts duplicated the watcher timer chain

| Field | Assessment |
| --- | --- |
| Subsystem / category | Morning Announcements / Async timer ownership |
| Priority / confidence | P1 / Reproduced with the actual lifecycle queue and timers |
| Baseline locations | `src/server.js:753-769` |
| Complexity / compatibility risk | Small / Timer ownership only |
| Expected benefit | Retain one polling cadence and avoid accelerated release checks |
| State | Implemented; native qualification passed |

Restart cleared the saved timer but could not retire an already-running callback.
That callback later scheduled another chain. A callback waiting in the lifecycle
queue also survived replacement. Each restart now advances a generation; both
queue admission and rescheduling require ownership. Normal interval bounds,
manual sessions and shutdown drain remain intact.

## RG-ANN-002: Unknown and diagnostic observations shortened offline evidence

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement release / Evidence continuity |
| Priority / confidence | P1 / Reproduced through the actual tick and Check handler |
| Baseline locations | `src/server.js:1171-1180,5505-5521` |
| Complexity / compatibility risk | Small / Matches documented consecutive-offline policy |
| Expected benefit | Prevent release from interrupted evidence or repeated Check clicks |
| State | Implemented; native qualification passed |

Three offline results, one unknown, then three offline results released an active
announcement despite the consecutive-evidence contract. Manual Check requests
also incremented the same counter. Only automatic periodic offline observations
now advance it. Live/unknown results and probe errors reset the streak. Manual
offline diagnostics remain observable without advancing automatic release.

## RG-ANN-003: Old probes acted on replacement settings

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement configuration / Probe result ownership |
| Priority / confidence | P1 / Reproduced with delayed live, offline and failed probes |
| Baseline locations | `src/server.js:1155-1180,5498-5525` |
| Complexity / compatibility risk | Small / Obsolete diagnostic replies now return 409 |
| Expected benefit | Keep old stream evidence from starting/stopping a new configuration |
| State | Implemented; native qualification passed |

The tick awaited a probe and then read mutable settings. A replaced configuration
could therefore inherit an old live result, offline threshold or error. Automatic
and diagnostic probes now capture their configuration owner. Old results cannot
change current runtime status or dispatch; obsolete Check requests return a
retryable 409 response. Current errors remain visible.

## Evidence and remaining review

The 20-case suite passes six controls and fails 14 cases on the exact baseline;
all 20 pass with the patch. Tests execute the real watcher, lifecycle queue,
tick and Check handler with controlled probes and timers. The expanded suite has
391 passes, zero failures and seven Linux-only skips (398 total). The final
native active-worktree snapshot passes 1,308 tests, zero failures and two root-only
ownership skips (1,310 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact
images and backed-up delivery remain.
No live stream, receiver, music session or production fault was exercised.

Configuration persistence is now covered by [its transaction patch](announcement-configuration.md).
Failed release/priority reconciliation,
the remaining audio lifecycle and Background Music editor are still under
review. This patch does not close the subsystem or the modernization roadmap.
