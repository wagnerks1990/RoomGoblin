# Background Music player probe ownership

Baseline: `2f3b06d67abdd0f4f6737bef7c52b8e0dc90cd3a`. Three actual-probe
reproductions and two actual-status-route reproductions fail before this change.

## RG-MUSIC-009: Old lookups contaminated the current cache and status

Player probes shared a single pending/cache entry without connection identity.
An old output could overwrite a newer cache; a connection reset could reuse a
pending lookup or cached reading from the previous endpoint/token. The status
route then combined pre-await player data and schedule with post-await runtime
and an unrelated shared probe error. This is P1.

Pending/cache entries now retain the player and explicit connection generation.
Only the latest-started probe can publish shared cache state. Connection
retirement prevents old telemetry and the legacy player-list retry from crossing
into the replacement connection. Current single-flight, four-second caching,
forced refresh, supported player aliases and same-connection compatibility
fallback remain.

The Background Music status response rechecks session, player and connection
after the lookup and returns the current schedule/runtime. If ownership changed,
the reading is unknown with a refresh message; old telemetry is not attached to
the new session. Successful readings cannot inherit another output's failure.
Current matching probe errors remain visible. Missing players and transport
failure remain distinct.

## Qualification and delivery boundary

All 20 new actual-function/route cases and all 114 expanded music/priority tests
pass. Coverage includes reversed success/error completion, pending/cache reset,
retired compatibility retry, current cache/force/single-flight, aliases and
availability, current errors, same/different-player successors, idle output
changes, connection changes and fresh schedule fields. The existing HTTP quota
fixture now supplies the production generation fields; all its assertions remain.

The supported Linux active-worktree suite passes 1,531 tests, zero failures and
two root-only ownership skips (1,533 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, exact images and backed-up
delivery passed in PR #302; see [the receipt](music-observation-delivery.md). No physical playback commands or production
failure injection were used. Wider connection-status reads, Live Watch manual
check responses and the remaining modernization roadmap remain under review.
