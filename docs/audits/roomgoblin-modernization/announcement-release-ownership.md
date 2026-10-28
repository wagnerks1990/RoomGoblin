# Announcement release recovery ownership

Baseline: `ca8b2870f5b958d82dd61b68bb28afaaba97268d`, the qualified deferred
bookkeeping patch. Two actual-function reproductions fail on this baseline;
the bookkeeping reproduction now passes as a control.

## RG-ANN-009: A successor left an older failed release hold stranded

The retry captured only its original targets. If it fired while a newer
announcement was active, it returned without another attempt. The successor's
successful release removed only its own hold, leaving the older hold forever.
This is P1, reproduced in `scheduleMorningAnnouncementsReleaseRetry` and
`releaseMorningAnnouncements` (`src/server.js:1153-1199` on the baseline).

Pending targets now have their own process-local registry. A successful release
finishes all pending targets, including older sessions. A timer whose work has
already completed does nothing. Existing serialized lifecycle, freeze and
shutdown admission remain intact.

## RG-ANN-010: Resync retry forgot a failed clear and could release music

A release-clear error retained the audio hold initially, but the retry only
performed display resync. An empty/successful resync could then release music
while the failed clear had never been retried. Blindly repeating that clear would
instead risk overwriting newer content. This is P1, reproduced in the same
release/retry functions; the shared dispatch boundary is `src/server.js:4723`.

Each pending target retains its original content ID and an owned clear command
ID. Clears are retried with that identity only while still applicable. The
internal dispatch option filters superseded targets after asynchronous admission,
checks again between MQTT writes and limits audio observation to content still
owned by the clear. Ordinary commands keep their existing behavior. A known
legacy broadcast alias fails closed; removed receivers retire pending entries.
Current winners are reconciled before music priority is released. No new public
command field, persistent identity or configuration migration is introduced.

## Qualification and delivery boundary

All 18 new actual-function cases pass, covering successor/same-target sessions,
clear failures before/after state updates, retained errors and successful retry,
newer content, obsolete timers, freeze/thaw, shutdown, removed receivers,
asynchronous admission, partial target filtering, MQTT delivery races, ordinary
commands and refusal of unsafe source/broadcast usage. Existing priority and
bookkeeping fixtures now execute the real pending-clear helper and preserve
their prior assertions.

The final expanded focused set passes 79 tests. An earlier broader Windows run
passed 93 and failed one unchanged Linux directory-mode assertion; the native
suite passes that unchanged check on its supported platform: 1,389 passed,
zero failed and two root-only ownership skips (1,391 total), plus all 23 Host
Recovery tests and Node/controller/Python/Bash checks. Required CI,
checked integration, exact images and backed-up delivery remain pending. All
dispatches here use deterministic fixtures, not production receivers or music.

Failed takeover-start cleanup has a separate
[follow-up and qualification](announcement-start-failure.md). This patch's
successor acceptance covers successful starts followed by release. Replacement
of an already active session remains a separate review.
