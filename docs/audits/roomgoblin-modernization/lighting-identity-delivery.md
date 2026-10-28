# Lighting command identity delivery

PR #315 passed all 14 checks without unresolved reviews and merged as
`af76c5a85ed7d9ef5bb26bdea6b631e6195ffee2`. All four required main workflows and
exact image publication passed. The normal backed-up Hub-only update completed
at `2026-10-28T08:28:41.910179+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, exact Hub image revision, healthy
services with zero restarts, control/media readiness, maintenance/Host Agent
health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and ten served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T08-28-27-922Z.zip` is 128950596 bytes, mode
0600, SHA-256 `83ecaa8071d645fb62c343d2a5a9723e8f7f6f560fdf4753c66ffe008c249e65`.
ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `5ffba818197de5774b576a2a62dd85b35559dba1` and its prior images is
available; rollback was not exercised. No physical lighting/display commands,
production uploads or fault injection were used.
