# Presentation session and controller delivery

PR #310 passed all 14 checks with resolved security reviews and merged as
`906e0ec1f2fb2ebc9f3c6444dd38823e27eb0b8a`. All four required main workflows and exact image
publication passed. The normal backed-up Hub-only update completed at
`2026-10-28T06:45:44.553292+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, the exact Hub image revision,
healthy services with zero restarts, control/media readiness, maintenance/Host
Agent health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and ten served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T06-45-30-967Z.zip` is 128890587 bytes, mode
0600, SHA-256 `b63138e078f140821136b1f0a563256c525e7447fc629d145995a1d3306deda4`.
The ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `86ce127636b89e2a2077f225ec1cdff7e29a1ff6` and its prior images is
available; rollback was not exercised. No production uploads, physical receiver
commands/reloads or fault injection were used.
