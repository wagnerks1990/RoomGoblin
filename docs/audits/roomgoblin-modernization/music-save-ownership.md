# Music workspace save ownership

Baseline: `30f6d861b06abf03d1b7493e3e69dcb1622d7ac5`. The Music workspace is
unchanged from the initial reproduced baseline `ef7be2c88dedcb762a1b4915cc8d8f2a09af6c27`.

## RG-MUSIC-001: Late saves replaced newer drafts and cleared newer tokens

| Field | Assessment |
| --- | --- |
| Subsystem / category | Background Music workspace / Async editor ownership |
| Priority / confidence | P1 / Reproduced in actual Chromium workspace |
| Baseline locations | `public/controller/music-studio.js:15,43-44,81,104-131` |
| Complexity / compatibility risk | Small / Browser-local ownership; existing APIs retained |
| Expected benefit | Preserve operator edits and prevent duplicate settings writes |
| State | Implemented; final native qualification passed |

A completed schedule save cleared the dirty flag and refreshed the selected
favorite even after a newer edit. Connection completion similarly reset the URL
and unconditionally cleared a newly typed token. Two pending saves could write
the same form concurrently. Three browser reproductions fail on baseline.

Each form now has a draft revision and one pending write. Completion clears its
dirty flag only for the submitted revision; newer edits remain visibly unsaved.
The token field has separate revision ownership so the submitted secret is
cleared without clearing a later entry. Inputs remain editable while the form's
save control is disabled. Failures retain the draft and release the pending guard.

Save/reload operations invalidate earlier reads. The shared reader remains
single-flight and coalesces a requested refresh after the current read finishes.
Schedule initialization and explicit reload respect edits made during the read.
Reload cannot discard a draft while its save is pending. Existing capability
checks, backend authorization, API fields and physical playback remain intact.

## Evidence and delivery boundary

All ten Music workspace browser tests pass in Chromium and Firefox. Seven are
new save/reload cases: newer schedule drafts, duplicate schedule writes, newer
connection fields, failed-save retry and editable inputs, duplicate connection
writes and submitted-token clearing, edits during reload, and a poll that began
before a successful save. The three existing listening/mobile/favorites tests
also pass. Controller syntax and runtime-symbol validation pass.

All 70 broader workspace Chromium tests also pass. The first native run was
interrupted when the local session ended; it is not counted as a pass. The final
native active-worktree snapshot passes 1,354 tests, zero failures and two root-only
ownership skips (1,356 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks.

Checked integration, required CI, exact images and normal backed-up delivery
are complete in PR #297; see the receipt below. Browser transports are deterministic fixtures;
no live credentials, music sessions or physical commands were used.

The combined integration with the announcement probe bound on merged main
`ac1ae40` preserves these implementation and browser-test files byte-for-byte.
Its final native snapshot passes 1,365 tests, zero failures and two root-only
ownership skips (1,367 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. PR #297 subsequently passed its CI and delivery gates.

## Firefox fixture synchronization

PR #297's first Firefox job (`122567489152`, run `40612597609`, head `af08a26`)
passed all ten Music tests but failed one existing shared-layer preview test:
the second request event fired before its route callback appended the second
held request (`1 != 2`). The job ran 184 tests with one failure. The fixture now
waits at most five seconds for both route callbacks before asserting exactly
two requests and exercising the same obsolete-error ordering and UI assertions.
No product code, expected outcome, workflow or check was relaxed.

The corrected full workspace suite passes all 70 tests in Firefox and all 70
in Chromium. Fresh required CI passed on corrected head `e587248`: all 14 checks succeeded.

## Verified probe/Music appliance delivery

PR #297 merged at `ce3135724550fb1d2c75e3ed42bb98d9eb638556`. All 14 PR checks
and all five main workflows passed. The normal updater completed at
`2026-10-28T01:41:08.469201+00:00`, replacing the Hub and retaining the healthy
maintenance container. Control/media endpoints, maintenance/Host Agent health,
all eight encrypted secrets, database/ADB modes, authorization and served assets
passed verification. Main is clean; the selective plan has no remaining changes.

Operational backup `auto-operational-2026-10-28T01-40-54-827Z.zip` is 128,693,307
bytes, mode 0600, SHA-256
`0d1f99b8f3d7eaa11f9db91b15f89591d93490aae6a15d63e94537ed1ba22706`.
Archive CRC, manifest/canonical-database selection and extracted SQLite integrity
passed. Rollback to `ac1ae4002adf3995d079836a13245e3e8449b636` and its images is
available; rollback was not executed. No physical commands, receiver reloads or
production fault injection were used.
