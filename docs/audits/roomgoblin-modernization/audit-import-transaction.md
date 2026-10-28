# Legacy audit import transaction

[Finding classification and immutable source locations](finding-metadata.md#audit-import-transaction).

RG-DB-001 reproduces two SQLite failures: a failed audit insert was swallowed as
malformed input, allowing partial history to commit and the source to be archived;
a failed migration marker left committed rows that a restart could duplicate.
Four compatibility controls passed on the baseline.

The importer now separates JSON parsing from database insertion, propagates
storage failures and commits all accepted rows with their migration record.
Archiving follows commit. Malformed-line handling, the source format, archive
location, disabled-archive option and restart idempotency remain compatible.
There is no schema migration or production history modification.

All 31 targeted audit/storage/planning/settings cases pass, including the six new
real-SQLite import cases. They cover row, marker and deferred-COMMIT failures,
retry after restart, normal import/archive and malformed input. The supported
Linux snapshot passes 2,470 tests, zero failures and two root-only skips, plus
all 23 Host Recovery and 55 Android JVM cases and syntax/controller/Python/Bash
checks. Checked delivery is pending.
