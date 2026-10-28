# Announcement target admission and unchanged-session recovery

Baseline: `a811376bc1d8002349d9bbe0a18673bb8cc5205c`, the qualified recovery
integration. Eight actual-function cases reproduce four failures with four
passing controls.

## RG-ANN-012: An empty explicit selection could dispatch to other receivers

The manual start route resolves requested receiver IDs before passing them to
`assertMorningAnnouncements`. Its empty-array fallback (`src/server.js:948`)
then selected the configured targets, potentially all displays. An unknown target
resolved inside the function instead silently returned success. This is P1.

An explicit override must resolve enabled receivers or fail before any priority
or display mutation. Only an absent override selects configured targets. Automatic
operation with no configured receivers remains a no-op. No request can use an
empty selection to widen its target scope.

## RG-ANN-013: A failed replacement forgot an untouched active announcement

The start error handler (`src/server.js:968-981`) reset active runtime and removed
the prior mandatory hold even when no content changed. An existing player could
continue without its lifecycle lock, including after operator Resume failed.
This is P1, reproduced for both the same and a different requested receiver.

Capture the prior runtime fields and content identities before replacement. If
the failed attempt owns no changed content and every prior receiver still has
its captured identity, retain the original target-array identity, mode, timestamps
and holds. This also preserves ownership of prior delayed audio retries. Release
only newly acquired non-pending holds. Never restore that old content or delayed
audio identity after a partial takeover. The later active-target follow-up refines
partial failure to retain continuing lifecycle ownership until release or Resume.

## Qualification and limits

All eight new cases and all 66 expanded focused checks pass. Cases cover empty
and unknown overrides, unchanged same/different-target failure, no configured
receivers, a valid selected receiver, successful replacement and partial failure.
The supported native active-worktree suite passes 1,409 tests with zero failures
and two root-only ownership skips (1,411 total), plus all 23 Host Recovery tests
and Node/controller/Python/Bash checks. Required CI, checked integration and
appliance delivery remain pending. All commands use deterministic fixtures, not
production devices.

Successful replacements with different target sets and partial failures affecting
only some previously active receivers are covered by the separate
[active-target follow-up](announcement-active-targets.md).
