# Media settings across reconnect

Baseline: `b8064b7ff37a4ce4ec0ad77bf2baf103e368f712`.

## RG-MEDIA-001: Reconnect snapshots lose live media settings

Three actual state-owner reproductions fail: volume, mute and playback rate
commands reach the receiver but do not update its saved media settings. The
next hello snapshot can overwrite those settings. This is P1 for playback
continuity and unexpected audio restoration.

Persist these settings on the existing selected video session. Positive volume
unmutes, while zero volume preserves mute intent, matching the receiver. Retain
the URL, session ID, clip boundaries, looping, timer and content identity. Other
media kinds and unselected receivers remain unchanged. Playback position and
pause/play operations remain receiver-owned; snapshots do not replay seeks or
restarts. Fresh-page playback-position recovery is a separate review item.

Use one finite-value validator for the HTTP control route and command router.
Keep numeric input conversion and bounded values; reject nonfinite values before
persistence or dispatch. Zero playback rate now clamps to the supported minimum
of 0.25 instead of being interpreted as an omitted default. Preserve existing
authentication, mutation quotas and returned handler ownership.

Token renewal also reproduced an unwanted video replacement in the actual
browser. That separate part of RG-MEDIA-001 is covered by the
[receiver continuity follow-up](media-token-continuity.md).

## Validation and delivery boundary

Ten new actual-state, validator and route cases cover persistence, independence,
content identity, invalid input and transient operation non-replay. An existing
router fixture needed the newly imported media owner; its assertions are unchanged.
All 34 focused checks pass. The supported Linux snapshot passes 1,658 tests,
zero failures and two root-only skips (1,660 total), plus all 23 Host Recovery
tests and Node/controller/Python/Bash checks. All five audio-control browser
tests pass in both Chromium and Firefox. Checked delivery remains pending.
No physical receiver commands or reloads were performed. The broader
media/presentation review remains in progress.
