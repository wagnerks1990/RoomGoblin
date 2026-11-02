# Resumable upload completion receipts

[Finding classification and immutable source locations](finding-metadata.md#upload-completion-receipts).

Baseline: `7cff7fdcecfc0e1088fe2a62a3a65b6c1099cb9f`.

## RG-MEDIA-006: Lost completion replies cannot recover the registered item

An actual-route/store reproduction confirms that repeating successful completion
returns 404, even though the registered file exists. The browser then loses its
ability to recover that result and can create a duplicate upload.

The owned session now pins its destination before assembly. Only verified bytes
pin the completion digest. Registration saves a private session/digest identity
in the library; its cache identity is published only after SQLite accepts it.
A private session receipt records successful registration before reclaiming
chunks. Retrying completion uses the same library item, including after a new
store/runtime starts or receipt publication fails after library persistence.
Concurrent requests retain the existing per-session lock and register once.

Replay checks the supplied digest, library identity, current membership, file
availability and size. A completed receipt cannot recreate a deleted/missing
file. Conflicting identity/digest/size is a visible error. Receipt data and
internal library identity are excluded from public responses.

Receipts keep the existing session TTL (24 hours by default), owner isolation
and 0750/0640 shared-maintenance permissions. Only receipts with completed chunk
reclamation stop consuming active-upload quota; cleanup failures remain quota
conservative and retryable. Expiry/cancellation removes the receipt, not the
published media. Chunk requests and the accepted-caller completion budget remain
unchanged. Legacy direct assembly callers keep their existing cleanup contract.

This is application-level retry recovery, not a cross-filesystem/SQLite atomic
transaction or power-loss durability claim. Concurrent deletion now has
[media-identity coordination and retirement checks](media-library-ownership.md)
under RG-MEDIA-007, including the gap before receipt publication. Office-conversion recovery and
the browser message when completion wins a cancellation race remain open.
An older application can expire/cancel these additive session records but does
not support replaying their reclaimed chunks; registered media remains separate.

## Qualification

Twenty-three new actual-source/store cases cover successful/lost replies, fresh
runtime recovery, concurrent completion, receipt/cleanup failures, quota release,
digest changes, ownership, missing/deleted files, identity conflicts, metadata
privacy, permissions and TTL cleanup. Ten existing registration cases now assert
the retained private receipt and removed chunks instead of a removed directory.

The first full run found a stale content-permission test fixture missing
`persistJson`: 1,735 passed, one failed and two skipped; recovery tests did not
run. Its dependency is now supplied without changing the permission assertions.
The combined targeted set passes 43 tests with two root-only skips (45 total),
including the five completion-rate regressions. The corrected combined Linux
snapshot passes 1,741 tests, zero failures and two root-only skips (1,743 total),
plus all 23 Host Recovery tests and Node/controller/Python/Bash checks. Checked
delivery remains pending. No production uploads or classroom receivers were
modified for these tests.
