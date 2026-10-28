# Media controller and cancellation delivery

PR #309 passed all 14 checks and merged as
`86ce127636b89e2a2077f225ec1cdff7e29a1ff6`. All four required main workflows and
exact image publication passed. The normal backed-up Hub-only update completed
at `2026-10-28T06:12:42.236015+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, the exact Hub image revision,
healthy services with zero restarts, control/media readiness, maintenance/Host
Agent health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and ten served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T06-12-28-463Z.zip` is 128876971 bytes, mode
0600, SHA-256 `356e410291117ff84a58fa7127899e272de3b90b27441f27df9adcc178721007`.
The ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `43b4d83c394b997f8bb4c845ae0c43d2c4eb7901` and its prior images is
available; rollback was not exercised. No production uploads, physical receiver
commands/reloads or fault injection were used.
