# Receiver identity delivery

PR [#341](https://github.com/wagnerks1990/RoomGoblin/pull/341) merged as
`3bdc179f711b7048a9202fa05dea4d970850756f` after all 14 exact-head checks passed
and all four review threads were resolved. Its exact PR-head Linux qualification
passed 2,516 Node tests, zero failures and two root-only skips (2,518 total), all
23 Host Recovery and 55 Android JVM cases, plus Node/controller/Python/Bash checks.
All 33 receiver browser cases passed in each engine, including actual uppercase
canonical/query URLs and enrollment hello messages.

Required main Validate, Display browser regression, Security gates and exact
image publication passed. The normal backed-up selective Hub update completed
on 2026-10-28 at 20:19:12 UTC. The unchanged maintenance container remained healthy
with its original start time and zero restarts; the new Hub also has zero restarts.

Read-only acceptance verified clean main and the exact Hub revision, an empty
remaining component plan, healthy control/media/maintenance/Host Agent endpoints,
canonical SQLite integrity, all eight encrypted secrets, database/ADB modes and
authorization boundaries. All 28 served assets, seven Hub modules, six maintenance
modules, four native executable hashes and the persisted Android signing identity
matched the expected source or manifest.

Backup `auto-operational-2026-10-28T20-18-58-591Z.zip` is 129,516,225 bytes, mode
0600, with SHA-256
`97f05a9195b1ad2e4d3fd06f3a9a48e0e6b9c8c9b25c59a87577f6019238dd5f`.
Journal checksum, ZIP CRC, canonical-database-only content and extracted SQLite
integrity passed. Rollback to `8357bec099c0a9acf0241519d7b2028ce4eee126` remains
available. No production receiver was enrolled, commanded or reconfigured for
acceptance, and physical display behavior was not claimed from health checks.
