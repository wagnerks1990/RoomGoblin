# Background Music recovery attempt accounting

Baseline: `b73e19db7a6c152c0c5c467139955d95236f5562`. An actual Start function
with the real recovery monitor counts one rejected playback command twice.

## RG-MUSIC-010: One failed start doubled its retry backoff

Both inner and outer Start catches marked a rejected playback request failed.
The inner catch cleared the confirmation wait, causing the outer catch to
register another attempt. The first explicit rejection therefore advanced to
the second backoff interval. This is P2.

The existing current-generation outer catch now owns that transition. Readiness
and pre-play failures still register once. Uncertain execution retains its
observation wait and is not replayed; a retired request cannot alter a successor.

## Qualification and delivery boundary

All six new real-recovery-monitor cases and all 96 expanded music/priority checks
pass, covering rejected/uncertain
playback, subsequent recovery attempts, readiness failure, pre-play control
failure and retirement. The supported Linux active-worktree suite passes 1,537
tests, zero failures and two root-only ownership skips (1,539 total), plus all 23
Host Recovery tests and Node/controller/Python/Bash checks. Required CI, exact
images and backed-up delivery passed in PR #302;
see [the receipt](music-observation-delivery.md). No physical commands or
production failure injection were used; the wider modernization remains active.
