# Upload registration ownership

Baseline: `058da6240c5898a17e4bec9edf4d9e9749da6116`.

## RG-MEDIA-003: Registration failure discarded all uploaded bytes

The actual completion route and upload store reproduce a P1 failure:
assembly deletes the session before library registration; if registration
then fails, the route also deletes the verified destination. Neither chunks
nor the completed file remain available for retry.

Assembly now awaits a trusted internal registration callback while holding
the existing session operation lock. It reclaims chunks only after registration
returns an available library file. Registration failures retain verified chunks
for an explicit retry. Cleanup and queued cancellation cannot interrupt the
accepted registration. A cleanup/response failure after successful registration
cannot delete the published file. SHA-256, signature inspection, owner isolation,
destination constraints and tracked HTTP promise ownership remain in place.

This is not a durable completion receipt: a lost successful response or cleanup
failure can still require reconciliation, and retrying a completed operation is
not yet guaranteed to return the same library identity. Partial library metadata
or converted outputs after failed registration also need a separate review.
No cross-file/database transaction or process-crash atomicity is claimed.

## Validation

PR #307's CodeQL gate identified missing rate limiting on completion. Add a
fixed appliance-wide budget of 12 accepted completion requests per minute before
the capability guard. The skip predicate uses that same `media.manage`
authorization boundary, so anonymous, rejected and unconfigured callers cannot
consume it. Chunk transfers, status reads and cancellation have separate paths.
Five regressions, including real HTTP checks, verify the quota, Retry-After,
forwarded-address and session-ID rotation, capability/legacy rejection and
unaffected chunk transfer.
The supported Linux run with this repair passes 1,718 tests, zero failures and
two root-only skips (1,720 total), plus all 23 Host Recovery tests and syntax
checks. Fresh CodeQL and required CI remain necessary before merge.

The original data-loss reproduction now passes. All 27 targeted store/route tests
pass, including ten new cases covering retry, registration ownership, queued
completion/cancellation, expiry, cleanup/response errors, missing result files,
digest rejection and caller isolation. The supported Linux snapshot passes
1,713 tests, zero failures and two root-only skips (1,715 total), plus all 23
Host Recovery tests and Node/controller/Python/Bash checks. Checked delivery
remains pending. These tests use temporary files and injected failures;
they do not alter production uploads or physical classroom devices.
