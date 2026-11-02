# Export-freeze fixture setup contention

[Finding classification and immutable source locations](finding-metadata.md#freeze-fixture-contention).

PR #335's Validate run `40728610299`, job `122958510303`, failed before
export-freeze admission. Its direct SQLite fixture connection attempted to seed
last_seen_at while the running application held a write lock. The fixture had
SQLite's default immediate-busy behavior, unlike the application's bounded
five-second busy timeout. The failure was at test/read-housekeeping-freeze.test.js
line 54, not a frozen-read or credential-validation assertion.

The fixture now sets busy_timeout=5000 before seeding. No application code,
freeze assertion, authentication requirement, retry loop or timing sleep changes.
All 20 consecutive supported Linux repetitions of the canonical authenticated
read/freeze case pass. Required CI must still pass on the updated PR head.
