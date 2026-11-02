# Announcement audio content ownership

Baseline: `c7b4ac0b982fabad22b3c0241375e94c3656419b`. Three initial actual-function
reproductions fail. The expanded 15-case set reproduces 13 failures and two
passing controls against that same baseline.

## RG-ANN-018: Session-wide audio retirement lost continuing receivers

`scheduleAnnouncementAudioRetries` (`src/server.js:921-930`) used the global
target-array identity. Adding a selected receiver, successfully or partially,
retired needed retries on an unchanged earlier receiver. Conversely, replacing
content without ending the logical announcement left old retries able to control
the new content. This is P1.

Delayed audio now belongs to the captured content ID of each receiver. A retry
requires active announcement ownership, current target membership and that same
content ID. Adding another receiver preserves the continuing player's existing
retry timing. A new takeover on the same receiver or a content replacement
retires its earlier retries. No unselected receiver gets another takeover.

## RG-ANN-019: Audio dispatch could reach content replaced during delivery

The live-volume path and router (`src/server.js:932-940,4773-4909`) lacked the
conditional ownership already used for release clears. Volume could affect an
operator replacement, and content could change while audio waited for admission
or an earlier transport write. This is P1.

Live volume selects only current announcement media. Both live volume and delayed
audio pass captured identities through the narrow internal announcement router
option. Recheck after asynchronous admission, between transport writes and before
audio-priority observation. Audio preserves its existing content ID; conditional
clear still owns its newly assigned clear ID. Reject unrelated sources/types and
shared legacy broadcasts. If every target changed before dispatch, report that
volume was not applied. Existing authentication and API fields remain unchanged.

## Qualification and delivery boundary

All 15 new cases and all 93 expanded announcement checks pass. Cases cover
continuing/partially added receivers, same-target successors, changed/removed
content, asynchronous admission, WebSocket/MQTT races, partial targets, live
volume results, unauthorized conditional use and broadcast refusal. Existing
fixtures now supply per-takeover content IDs and model audio without changing that
ID. Their successor, volume, freeze/shutdown and no-reload assertions remain.
The earlier partial-addition assertion is refined to permit retries only for its
unchanged continuing receiver, never the changed or failed addition.

The supported native active-worktree suite passes 1,460 tests, zero failures and
two root-only ownership skips (1,462 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. After the independently qualified preview-route
fixture was cherry-picked, restored runtime/Node files exactly matched the
qualified stash snapshot. Required CI, exact images and backed-up delivery passed
in PR #301; see [the receipt](music-session-delivery.md). No physical commands or production failure
injection were used. Background Music session reconciliation remains separate.
