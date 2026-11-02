# Android capability delivery

PR #333 merged as `2c682540334111d50b5958455d2927ec05d00b36` after all 14
checks passed. Main Validate, Display browser regression and Security gates
passed, followed by exact Hub and maintenance image publication.

The normal updater completed at `2026-10-28T16:36:23.547685+00:00`. Its plan
replaced only the Hub, which reports the exact merged revision. Maintenance
retained its verified container identity, start time and `519ca69` revision;
all six Android maintenance modules match source hashes. Both containers are
healthy with zero restarts; main is clean and the remaining selective plan is empty.

Verification passed control/media, maintenance and Host Agent health, database
quick-check, decryption of eight secret rows, shared database and ADB identity
modes, internal/admin authorization boundaries, 22 served assets and all four
native Windows artifact hashes. Runtime version remains `1.0.0-alpha.85`.

Backup `auto-operational-2026-10-28T16-36-09-673Z.zip` is 129,228,264 bytes,
mode 0600, SHA-256
`8f2c7c944b3d0812e7af9ddd4a3edc00456c4ee2e3a458e9fb2e696c4a798b62`.
Archive CRC, canonical database scope and extracted SQLite quick-check pass.
Rollback source `519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d` remains available;
rollback was not exercised. No physical display command or workstation install
was performed.
