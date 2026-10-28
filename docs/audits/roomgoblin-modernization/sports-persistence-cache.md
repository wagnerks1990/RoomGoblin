# Sports durable saves and retired board reads

[Finding classification and immutable source locations](finding-metadata.md#sports-persistence-cache).

RG-SPORTS-005 reproduces four failures with real isolated SQLite databases.
Save and Undo each replaced the recovery snapshot when either the current-row
write or a deferred constraint at COMMIT failed. Three control cases pass before
and after repair.

Both preferences now commit in one transaction. Validation precedes writes and
memory changes only after COMMIT succeeds. Refresh retains its single-key write
and does not replace the staff undo snapshot. All 53 targeted Sports cases pass,
including seven real SQLite rollback/restart/success cases. In-memory fixtures
implement the same synchronous transaction contract; production has no fallback
to separate writes.

RG-SPORTS-006 reproduces two browser failures: a delayed board response renders
and caches retired content after Sports or authentication invalidation. Each read
now captures the cache generation and rejects retirement or cancellation before
returning/caching data. Existing cache lifetime, request timeout, receiver media
continuity and command boundaries remain unchanged. All 30 Sports browser cases pass in
Chromium and Firefox. The supported Linux snapshot passes 2,445 tests with zero
failures, two expected root-only skips, all 23 Host Recovery cases and all 55 JVM
cases, plus syntax/controller/shell checks.

All data and failures are isolated fixtures. No production persistence fault,
student data or physical display command was used.
