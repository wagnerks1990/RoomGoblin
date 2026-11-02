# Managed configuration and native enrollment delivery

PR #332 merged as `519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d` after all 14
checks passed. Main Validate, Display browser regression and Security gates
passed, followed by exact Hub and maintenance image publication.

The normal updater completed at `2026-10-28T16:18:11.501932+00:00`. Its plan
required full reconciliation, including both core containers and the Host Agent.
Both containers report the exact merged revision, and all six Android maintenance
modules match source hashes. They are healthy with zero restarts; main is clean
and the remaining selective plan is empty.

Verification passed control/media, maintenance and Host Agent health, database
quick-check, decryption of eight secret rows, shared database and ADB identity
modes, internal/admin authorization boundaries, 22 served assets and all four
native Windows artifact hashes. Runtime version remains `1.0.0-alpha.85`.

Backup `auto-operational-2026-10-28T16-17-28-448Z.zip` is 129,218,770 bytes,
mode 0600, SHA-256
`c62eb75135bccf7a9d9bfbd21552f78512b689183ad1849c95f59c8968bdf418`.
Archive CRC, canonical database scope and extracted SQLite quick-check pass.
Rollback source `e7c557a1fcde79d7108fa2d9e7024702b7296c27` remains available;
rollback was not exercised. No physical display command or workstation install
was performed.
