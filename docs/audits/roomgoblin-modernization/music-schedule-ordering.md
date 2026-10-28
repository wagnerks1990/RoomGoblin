# Background Music schedule save ordering

Baseline: `50322d48ad561d347296caa767cc991f24ccfb2d`. Two actual-route/Stop
reproductions fail: reversed command completion leaves the older schedule saved,
and late completion releases a newer manual Stop.

## RG-MUSIC-008: Awaited schedule saves lost order and successor intent

A schedule identity change stopped the active output before persistence. Two
accepted saves could finish in reverse order and persist the older settings
last. The old completion also unconditionally cleared the schedule key and
manual Stop, even when another control had acquired the session. This is P1.

Schedule writes now run in admission order and normalize against the preceding
committed settings. The returned HTTP promise covers queued work, Stop,
persistence and the reconciliation tick, retaining writer-drain ownership.
Failed requests leave the queue usable and report their existing errors.

The save captures the generation acquired by its Stop. Only its current,
successful completion clears the schedule key or releases manual Stop.
Independent manual playback remains available; a retired save may persist its
authorized settings without replacing the newer session's runtime. Uncertain
Stop is not retried, and failed persistence cannot undo an already sent command.

## Qualification and delivery boundary

All ten new actual-handler tests and all 70 expanded Background Music/priority
tests pass. Coverage includes save order, partial-field merging, newer manual
Stop/Play, current successful Stop, Stop/persistence failure and retry, unchanged
identity, invalid input, and returned-promise ownership through the final tick.

The supported Linux active-worktree suite passes 1,511 tests, zero failures and
two root-only ownership skips (1,513 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, exact images and backed-up
delivery passed in PR #302; see [the receipt](music-observation-delivery.md). No physical playback commands or production
failure injection were used. Coherent status/probe snapshots and the wider
modernization remain under review.
