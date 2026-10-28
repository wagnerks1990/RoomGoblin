# Legacy configuration and secret import transactions

[Finding classification and immutable source locations](finding-metadata.md#legacy-import-transaction).

RG-DB-002 reproduces five partial migration failures. Legacy JSON writes could
commit before their migration record failed, even while the caller received its
fallback. Normalized object migration could publish new tables while retaining
unmarked legacy rows. A secret import could report failure but leave the secret
stored, causing its next attempt to skip the missing migration record.

Each import now uses the existing synchronous SQLite transaction owner. Nested
normalized writers use its savepoints. Imported values, migration records and
the optional normalized source-row removal commit together. Existing database
values remain authoritative; malformed-input fallback, encryption, source-file
retention, formats and schema stay compatible.

All 41 targeted migration/storage/planning/settings cases pass. Ten new cases
cover the five reproduced failures, retries, retained database precedence and
four deferred-COMMIT failures. The initial six-case baseline passed one control
and failed five cases. The supported Linux worktree snapshot passes 2,480 tests,
zero failures and two root-only skips, all 23 Host Recovery and 55 Android JVM
cases, plus syntax/controller/Python/Bash checks. Checked delivery is pending.

Together with administrative settings and audit import repairs, this completes
the focused backend/database review of transaction ownership. Existing route
contracts, validation, handler drain, nested transactions, ordered schema checks
and database identity recovery remain covered by the supported suite. Broader
authentication, operational recovery and resource reviews remain separate units.
