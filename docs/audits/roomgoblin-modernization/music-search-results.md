# Music search result ownership

Baseline: `4daffefe279dbd6b80175b45e6e6aca3cbf0b2e4`.
Two actual-browser regressions failed before the change.

## RG-MUSIC-013: Repeated or invalidated searches lost result ownership

Search replaced the result DOM with its loading message but retained the card
cache key. An identical result then skipped rendering, leaving "Searching"
permanently. A short submitted query also returned before retiring the previous
request, allowing an older success or failure to replace the new intent. This
is P2.

Every submission now retires the previous search and invalidates the result-card
cache. Short queries clear obsolete result cards while retaining the existing
input guidance and issuing no network request. Favorites retain their stable
card cache. Current results, empty state, errors, retry, latest valid search,
playback identity and permissions remain unchanged.

Six new browser methods cover repeated identical results, short-query retirement
of success and failure, repeated empty results, retry after a visible error,
out-of-order valid searches and clearing/repeating a short query. All 16 Music
Studio cases and all 70 workspace cases pass in both Chromium and Firefox.
The supported Linux active-worktree suite passes 1,567 tests, zero failures and
two root-only ownership skips, plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required gates, exact images and backed-up
delivery remain pending. Deterministic transports issue no physical classroom commands.
