# Windows enrollment identity delivery

PR #323 merged as `7acaa7a1c725a53494ef5409a1d47d8792d9ad24` after all 14 checks passed and its review
threads were resolved. Its initial Linux failure led to a reproduced test-port
repair; fresh checks passed before merge. Validate, Display browser regression,
Security gates and Publish Main Images passed for the exact merged commit.

The normal backed-up full update completed at 2026-10-28T12:17:32.473794+00:00. Hub and maintenance
were recreated with that revision, healthy with zero restarts; Host Agent,
control/media health and runtime version 1.0.0-alpha.85 passed. Production main
is clean and the post-update component plan is empty.

Backup `auto-operational-2026-10-28T12-17-00-151Z.zip` is 129082693 bytes, mode 0600,
SHA-256 `17be1b0bff3a160c90ba9f4b49fdd25fc042bccd233aaffa08f80dc770183b13`.
Archive CRC, operational scope, canonical-only SQLite snapshot and its quick_check
passed. The current database integrity, eight encrypted secret rows, shared
database modes, ADB identity directory mode and authentication boundaries passed.
Four native artifacts match their manifest sizes and hashes; the served manifest
and 14 browser assets match the deployment.

Rollback to `ea648350e200e8f6130ae533d0fb7600790b0d82` remains available with its images and backup;
rollback was not exercised. No workstation agent, classroom display or scheduled
task was installed, restarted or controlled during acceptance.
