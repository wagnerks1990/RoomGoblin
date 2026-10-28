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
images and backed-up appliance delivery remain pending. Tests use deterministic
transports; no physical receiver commands or production failure injection were used.

The unchanged-content control here is a fresh start. The separate
[target-admission follow-up](announcement-target-admission.md) covers an untouched
prior active session when replacement fails before dispatch. Changed target sets
and partial replacement of an active session remain separate review.
