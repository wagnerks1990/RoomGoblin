# Native Windows process, transfer and connection delivery

PR #320 passed all 14 final checks and merged as
`d3a393778059d233b1b311dcf8dc2c3018db6490`. All required main workflows and the
exact Hub/maintenance image pair passed before the normal backed-up update.
The planner required full reconciliation; it completed at `2026-10-28T11:06:12Z`.

Both healthy container revision labels match the selected commit; the native
Host Agent is healthy, source is clean on main and post-update planning is a no-op.
Read-only acceptance passes control/media readiness, database integrity/shared
modes, all eight secret decryptions, authentication boundaries, ADB identity mode,
14 served asset hashes and all four native executable hashes plus the served
manifest. No workstation agent was installed, enrolled, restarted or commanded.

Backup: `auto-operational-2026-10-28T11-05-42-410Z.zip`, 129,037,596 bytes, mode 0600.
SHA-256: `fa6760fa069512e6f88260697213527bc50d859aa2d7a2b5dd30f7d8c380ad38`.
Archive CRC, canonical database-only scope and extracted SQLite quick_check pass.
Rollback to `0f24c99394bb4bd9dbaed887e94cb3b6a81b0436` is available and was not
exercised. No classroom command or live fault injection was performed.
