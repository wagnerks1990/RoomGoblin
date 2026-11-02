# ESPHome reliability delivery

PR #316 passed all 14 checks without unresolved reviews and merged as
`f74186637413d4c373bffdbf08ceef02c8166692`. All four required main workflows and
exact image publication passed. The normal backed-up Hub-only update completed
at `2026-10-28T09:01:38.579379+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, exact Hub image revision, healthy
services with zero restarts, control/media readiness, maintenance/Host Agent
health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and eleven served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T09-01-25-159Z.zip` is 128955502 bytes, mode
0600, SHA-256 `ea82696a97f6dde4b458b78b0a62c413db8e64bc9865a8f22a9fc34cd37639f0`.
ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `af76c5a85ed7d9ef5bb26bdea6b631e6195ffee2` and its prior images is
available; rollback was not exercised. No physical lighting/display commands,
production uploads or fault injection were used.
