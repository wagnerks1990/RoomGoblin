# Lighting persistence delivery

PR #314 passed all 14 checks without unresolved reviews and merged as
`5ffba818197de5774b576a2a62dd85b35559dba1`. All four required main workflows and
exact image publication passed. The normal backed-up Hub-only update completed
at `2026-10-28T08:06:12.019124+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, exact Hub image revision, healthy
services with zero restarts, control/media readiness, maintenance/Host Agent
health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and ten served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T08-05-58-492Z.zip` is 128935924 bytes, mode
0600, SHA-256 `afabb91c119ef472cf8da3be93467cf7344d9aa91f661eefa9a31c3e7b88ddfe`.
ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `5cf4c81830e97185f3e357d99d82f3251ee55024` and its prior images is
available; rollback was not exercised. No physical lighting/display commands,
production uploads or fault injection were used.
