# Presentation rebuild delivery

PR #311 passed all 14 checks without unresolved reviews and merged as
`fa5bb49036656c9d94e5b6685ef330593ca01865`. All four required main workflows and exact image
publication passed. The normal backed-up Hub-only update completed at
`2026-10-28T07:09:50.010529+00:00`, retaining the maintenance container.

Read-only verification confirmed clean main, the exact Hub image revision,
healthy services with zero restarts, control/media readiness, maintenance/Host
Agent health, SQLite integrity and eight secret decryptions, database/ADB modes,
authentication boundaries and ten served asset hashes. The post-update plan
requires no further reconciliation.

Backup `auto-operational-2026-10-28T07-09-36-262Z.zip` is 128909273 bytes, mode
0600, SHA-256 `8841f1d7d750f10b5bb6eb5ca6552ef7c5b949ac40163f7611c4c105fd0f147c`.
The ZIP CRC, canonical-only SQLite scope and extracted database integrity passed.
Rollback to `906e0ec1f2fb2ebc9f3c6444dd38823e27eb0b8a` and its prior images is
available; rollback was not exercised. No production uploads, physical receiver
commands/reloads or fault injection were used.
