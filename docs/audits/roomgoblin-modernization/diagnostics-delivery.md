# Diagnostics delivery

PR [#342](https://github.com/wagnerks1990/RoomGoblin/pull/342) merged as
`ea924b8e634ebc12e33ffa7db08535fa0825fb2f` after all 14 exact-head checks passed.
All 60 focused integration cases passed. Required main Validate, Display browser
regression, Security gates and exact image publication succeeded.

The normal backed-up selective Hub update completed on 2026-10-28 at 20:42:18 UTC.
Maintenance retained its existing container and start time. Both containers are
healthy with zero restarts; the remaining component plan is empty and main is clean.

Read-only acceptance verified control/media/maintenance/Host Agent health, canonical
SQLite integrity, all eight encrypted secrets, database/ADB modes and authorization
boundaries. All 28 served assets, seven Hub modules, six maintenance modules, four
native executable hashes and the persisted Android signing identity matched the
expected source or manifest.

Backup `auto-operational-2026-10-28T20-42-04-553Z.zip` is 129,530,900 bytes,
mode 0600, with SHA-256
`b407d97d7806f15bbd86733f0bfe365951039c5e2e0db26992f2b8dab7541d3a`.
The journal checksum, ZIP CRC, canonical-database-only content and extracted SQLite
integrity passed. Rollback to `3bdc179f711b7048a9202fa05dea4d970850756f` remains available.
No live physical command, capture or enrollment was used. Health and transport
evidence do not establish device acknowledgment or authenticated workstation control.
