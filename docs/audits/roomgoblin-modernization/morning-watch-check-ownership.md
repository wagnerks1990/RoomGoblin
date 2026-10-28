# Live Watch manual-check ownership

Baseline: `4074ac305339fa38159fc7f5d8bbe2f9b797644f`. Three real Chromium
reproductions fail: an old poll replaces CHECKING, an old poll replaces the
completed manual result, and capability refresh enables a pending check.
The capability-loss completion control already passes.

## RG-ANN-020: Polling and button refresh displaced a manual check

Manual checks did not advance read ownership or retain a pending command marker.
An older poll could overwrite the visible action/result, and capability refresh
could admit duplicate clicks while the request was still running. This is P2.

The manual check retains one promise, advances the read generation and marks its
button unavailable until completion. Current permission is checked before
dispatch and when restoring controls. Polling does not start another read while
the check owns status; older success/error responses are ignored. A settings
write retires an old check response with UNKNOWN and a check-again message.
Current LIVE/OFFLINE/UNKNOWN/error feedback, retry, saved-configuration semantics
and unsaved form drafts remain.

## Qualification and delivery boundary

All 11 new cases and all 16 existing Live Watch cases pass in Chromium and Firefox.
Coverage includes delayed polls, duplicate calls, capability refresh/loss,
permission admission, current error/retry, unavailable probe detail, reads
during a check, settings writes retiring success/error, and draft preservation.
All 70 broader workspace tests also pass in both Chromium and Firefox.
The supported Linux active-worktree suite passes 1,537 tests, zero failures and
two root-only ownership skips (1,539 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, exact images and backed-up
delivery passed in PR #302; see [the receipt](music-observation-delivery.md).

Tests use the actual controller and deterministic HTTP responses. No live
stream, physical classroom command, receiver reload or production fault injection
was used. Wider connection-status reads and the remaining modernization roadmap
remain under review.
