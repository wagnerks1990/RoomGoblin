# Announcement audio retry ownership

Baseline: `2d64bb2ea2e394c214a7696003ee3d16cfff0a3f`, the qualified announcement
configuration transaction. Audio retry behavior is unchanged from main `955195a`.

## RG-ANN-005: Retired audio retries controlled successor sessions

| Field | Assessment |
| --- | --- |
| Subsystem / category | Announcement audio / Delayed callback ownership |
| Priority / confidence | P1 / Reproduced with the actual retry callback |
| Baseline locations | `src/server.js:906-913` |
| Complexity / compatibility risk | Small / Existing retry cadence and commands |
| Expected benefit | Prevent old sessions from sending volume/unmute commands |
| State | Implemented; native qualification passed |

The retry captured old target IDs but checked only whether any announcement was
active. Stopping and starting another announcement before the old timeout fired
therefore sent a command to the old targets using the new session's volume.
The same issue existed when the successor reused the original receiver IDs.

Each retry now captures the runtime target-array identity created by its
takeover. Replacement retires that identity, so its callbacks become inert.
The current session keeps the four existing bounded retry delays, latest saved
volume, manual-mode behavior and shutdown/export-freeze guards. No receiver is
reloaded and no persistent identity changes.

## Evidence and delivery boundary

Eight actual-callback cases pass six controls and fail both successor-session
cases on the exact baseline. All eight pass with the fix. The focused suite
passes all 76 checks, including settings transactions, watcher ownership,
announcement stability, hallway priority and Background Music recovery.
The native active-worktree snapshot passes 1,330 tests, zero failures and two
root-only ownership skips (1,332 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, checked integration, exact
images and normal backed-up delivery remain pending. No physical audio behavior
was exercised.

The broader release/priority reconciliation review remains open; this change
does not claim to resolve those separate ownership failures.
