# Background Music session ownership

Baseline: `15e0c3ccae3c3dcb8687eef1042d5bac0ecff3f5`. Five initial actual-function
reproductions fail. Expanded coverage reproduces 21 failures with seven passing
controls against the same baseline.

## RG-MUSIC-005: Late control completion overwrote the current session

`backgroundMusicPause` and `backgroundMusicStop` in `src/server.js` advanced the
session generation before their commands but changed shared runtime after the
await without checking ownership. An old Stop could discard a newer source;
an old Pause could label it paused. Resume/Start error handlers could also put a
successor into the previous request's error/recovery state. This is P1.

Pause/Stop completion checks its generation and effective player. Resume/Start
errors update recovery only while their generation remains current. The original
call still receives its failure. Same-player successors are distinct sessions;
an idle configured-output change also retires the old completion. Current
successes and failures keep their existing behavior and bounded recovery.

## RG-MUSIC-006: Old probes and reconciliation changed successor intent

`backgroundMusicReconcilePriority` and `backgroundMusicTick` captured state before
awaited probes or control calls, then committed results without checking the
current session. Ended priority could still pause music; an old missing-player
result could mark a successor offline; late sleep/schedule/recovery completion
could overwrite current manual intent or action/error metadata. This is P1.

Recheck generation, effective player and current priority after probes. Track the
generation acquired by each invoked control helper before awaiting its result.
Only its current owner may write completion bookkeeping or errors. Priority that
ends during an accepted pause still leaves a priority-paused state for subsequent
resume; priority arriving during a probe is reconciled before recovery observes
that result. Current-player failures and uncertainty feedback remain visible.

## Qualification and delivery boundary

All 29 new cases and all 60 expanded Background Music/priority checks pass. Cases
cover different/same-player successors, configured-output changes, current
success/failure controls, retired start/resume errors, priority arrival/end,
late sleep/schedule stops, old probes and recovery completion. The existing
late-play compensation, no uncertain HTTP mutation replay, manual-source,
finite-track, sleep and priority checks remain intact.

The first native run passed 1,487 tests and failed one old source-pattern check
that expected the active-player expression inline instead of captured before the
await (1,490 total, two root-only skips). The source check now requires both that
capture and its forced probe; an added actual-function control verifies that the
active output, rather than a different scheduled output, is probed before pause.
A broader Windows check passed 76 and failed the unchanged Linux directory-mode
assertion. The final supported Linux active-worktree rerun passed 1,489 tests,
zero failures and two root-only ownership skips (1,491 total), plus all 23 Host
Recovery tests and Node/controller/Python/Bash checks. Neither failure was
bypassed; the directory-mode assertion passes on native Linux.

Required CI, checked integration, exact images and
backed-up appliance delivery remain pending. Fixtures execute actual functions
with deterministic transport/probe completion; they do not establish audible
playback. No physical commands or production failure injection were used.
Background Music configuration writes and coherent status/probe-cache snapshots
remain separate review, as does the wider modernization roadmap.
