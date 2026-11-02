# Failed announcement start cleanup

Baseline: `6eed2fe5c5eee9eb61e1ee80e60b88411b8c1a2c`, the qualified release
ownership patch. The initial eight actual-function cases reproduce six failures
and retain two passing controls.

## RG-ANN-011: Partial starts discarded their cleanup and priority ownership

`assertMorningAnnouncements` (`src/server.js:947-975` on the baseline) removed
all target holds when a takeover failed, even after state/transport delivery or
when an older release still owned that receiver. A failed priority pause could
leave announcement content playing without an active lifecycle or pending
cleanup. A second cleanup error could also hide the original failure. This is P1.

Each attempted clear/player command now has an explicit owned ID. Failed starts
queue conditional release only for content still carrying either ID, preserve
older pending release entries and keep those targets' mandatory audio holds.
The existing serialized retry clears owned content, persists deferred markers
and reconciles current display winners before releasing music. Unchanged and
superseding content are excluded. Secondary cleanup errors are diagnosed while
the original start error remains the caller's result.

## Qualification and limits

All 12 new cases pass, including failure before mutation, failures after clear
and player state updates, failed priority pause, older pending same/different
targets, invalid URL, secondary cleanup errors, content replaced during delivery,
partial target ownership, older pending ownership before a failed dispatch and
normal successful start. The expanded focused set passes 58 tests.

The supported native active-worktree suite passes 1,401 tests, with zero failures
and two root-only ownership skips (1,403 total), plus all 23 Host Recovery tests
and Node/controller/Python/Bash checks. Required CI, checked integration, exact
images and backed-up appliance delivery completed in PR #298; see the receipt
below. Tests use deterministic
transports; no physical receiver commands or production failure injection were used.

The unchanged-content control here is a fresh start. The separate
[target-admission follow-up](announcement-target-admission.md) covers an untouched
prior active session when replacement fails before dispatch. The
[active-target follow-up](announcement-active-targets.md) covers changed target
sets and partial replacement of an active session.

## Checked appliance delivery

PR [#298](https://github.com/wagnerks1990/RoomGoblin/pull/298) passed all 14 PR
checks and all five main workflows. Delivery completed at
`2026-10-28T01:58:08.254909+00:00` on `4a41f00afb65754a14e2d87f5855d3a35ab7d035`.
The normal updater replaced only the Hub and retained the verified maintenance
container. Clean main, exact image revision, control/media health, maintenance
and Host Agent health, all eight encrypted secrets, database integrity/modes,
ADB volume mode, authentication boundaries and served asset hashes passed.

Backup `auto-operational-2026-10-28T01-57-54-522Z.zip`
(128703238 bytes, SHA-256
`6324a652b5460abd875849dfa0f4bf6cb05394d2efda2c1fd85826a85ab33536`) passed archive,
manifest and canonical SQLite integrity checks. Rollback to
`ce3135724550fb1d2c75e3ed42bb98d9eb638556` and its images remains available.
No physical classroom commands, receiver reloads or production fault injection
were used. This also delivers the deferred-bookkeeping and release-ownership
fixes in the same checked integration.
