# Upload resume, cancellation and browser ownership

Baseline: `f3ff3aff3b26b168eacb9283690e275ba57e9d6f`.

## RG-MEDIA-005: Browser errors discarded resumable upload identity

Two actual-script reproductions fail: a temporary resume lookup error deletes
the saved session and starts another upload, while an HTTP cancellation failure
is treated as success and forgets the session. This is P1 for resume continuity
and P2 for error reporting.

Only a confirmed missing session permits fresh creation. Other HTTP/network
failures remain visible and retain the saved identity. Successful cancellation
or a confirmed missing session removes only the matching saved ID. Late success
from an old upload or cancellation cannot erase a successor's cache entry.

Within the page, share same-file startup requests and cancellation requests.
Cancel waits for accepted startup; a later same-file start waits for cancellation
before looking up or creating its successor. This does not claim coordination
between separate browser tabs, nor recover an unknown server session whose
creation response was lost.

Both controller upload flows own their progress, completion, errors, cancellation
and abort handles by operation generation. Starting a new upload pauses its
predecessor. Cancel targets the active file even after another file is selected.
Cancellation errors stay visible with retry available, while retired operations
cannot overwrite status or hide the current controls. Preserve handler IDs,
upload/resume/pause/cancel capabilities, SHA-256 and existing request limits.

## Qualification and delivery boundary

All 29 new cases pass: 17 execute the actual shared script and 12 execute both
actual controller upload blocks. Coverage includes HTTP/network failure, missing
sessions, startup/cancel sequencing, cache ownership and late UI callbacks.
The supported Linux snapshot passes 1,703 tests with zero failures and two
root-only skips (1,705 total), plus all 23 Host Recovery tests and the
Node/controller/Python/Bash checks. All 70 workspace browser tests pass in
Chromium and Firefox. Checked delivery remains pending. Backend
registration-failure recovery is still open; this browser change does not solve
that separate issue. No production
files, uploads or physical classroom devices were changed by these tests.
