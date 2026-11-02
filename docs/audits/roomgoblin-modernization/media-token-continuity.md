# Receiver video continuity across token renewal

[Finding classification and immutable source locations](finding-metadata.md#media-token-continuity).

Baseline: `19c0cc63c087ed6694181a8362d018fe9120c649`.

## RG-MEDIA-001: Signed URL renewal replaced a healthy video session

An actual-browser reproduction failed: a new hello token changed the authorized
URL, causing the same video session to be replaced and playback position lost.
Use the validated source URL and session ID for playback identity. Continue
authorizing every URL normally; new sources, query variants, routing or session
identities still replace the video. A healthy session keeps its element, loaded
source, position, pause state and latest saved settings during token renewal.

If the media source fails and a newer authorized URL is available, renew access
on the same video element. Preserve the position captured before the existing
one-time media-plane fallback can reset it. Recheck session ownership before the
queued reload; retain the media-plane routing and signed query. Allow at most
three consecutive fresh-token attempts, reset only by confirmed playback.
Repeated failure with the same token does not replay the source. Failure remains
visible after the budget is exhausted. There is no anonymous access fallback.

Renewal disables native autoplay and starts muted. Resume only current playback
intent through the existing autoplay-safe helper. Pause, seek, stop, restart and
explicit Play during renewal retain their latest intent. Retired callbacks cannot
reload or resume a successor session. Token refresh does not restart an automation.

## Qualification and delivery boundary

Fourteen browser cases exercise the real receiver and media-plane shim, with
deterministic media properties/events instead of actual decoding. They cover
identity, authorization routing, pause/position, control races, bounded retries
and retired owners. The original reproduction also uses the normal browser media
element. All 14 token cases, 30 receiver cases and five audio cases pass in each
of Chromium and Firefox. The first broader Chromium run had 14 layout failures
because ignored local font assets were absent. After executing the repository's
font preparation with normalized Windows line endings and an explicit root, all
original assertions pass; no test expectation was weakened.

The supported Linux snapshot passes 1,658 tests, zero failures and two root-only
skips (1,660 total), plus all 23 Host Recovery tests and Node/controller/Python/Bash
checks. All 23 focused media/security policy checks pass. Checked delivery remains
pending. No physical receivers were commanded or reloaded, and long-file hardware
playback has not been reaccepted. Fresh-page position recovery and missing session
IDs remain separate media-review items.
