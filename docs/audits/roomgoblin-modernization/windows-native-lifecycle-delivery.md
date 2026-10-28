# Native Windows lifecycle delivery

PR #321 passed all 14 final checks, including .NET 8 Windows execution, and
merged as `395cb88f4a135ea6b990458d8c53e520d282e5a3`. Required main workflows and
the exact Hub/maintenance image pair passed before the normal backed-up full
reconciliation, completed at `2026-10-28T11:33:13Z`.

Both healthy container revisions match the selected commit; the native Host
Agent is healthy, source is clean on main and post-update planning is a no-op.
Read-only verification passes control/media readiness, database integrity/shared
modes, eight secret decryptions, authorization boundaries, ADB identity mode,
14 served asset hashes, four native executable hashes and the served manifest.
No workstation agent was installed, enrolled, restarted or commanded.

Backup: `auto-operational-2026-10-28T11-32-42-713Z.zip`, 129,054,876 bytes, mode 0600.
SHA-256: `7c4f672ba39709cab502e10614f0d04b0f47e347a02ee3462634507778f17bd8`.
Archive CRC, canonical database-only scope and extracted SQLite quick_check pass.
Rollback to `d3a393778059d233b1b311dcf8dc2c3018db6490` is available and was not
exercised. No classroom command or live fault injection was performed.
