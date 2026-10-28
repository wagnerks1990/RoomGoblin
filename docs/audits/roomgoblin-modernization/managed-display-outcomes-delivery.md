# Managed-display outcome and enrollment delivery

PR #325 merged as `312f753f67f8b2cb3b89ba3f7dd3f66da6af2e84` after all 14 checks
passed and review threads were resolved. Validate, Display browser regression,
Security gates and Publish Main Images passed for that exact merged commit.

The normal backed-up update completed at 2026-10-28T13:01:21.041983+00:00. Its
selective plan replaced only the Hub, which reports the exact target revision.
Hub and maintenance are healthy with zero restarts. Maintenance retained its
verified PR #323 container, revision and 2026-10-28T12:17:19.978558272Z start time.
Host Agent, control/media health and runtime version 1.0.0-alpha.85 passed.
Production main is clean and the remaining component plan is empty.

Backup `auto-operational-2026-10-28T13-01-07-344Z.zip` is 129107967 bytes, mode 0600,
SHA-256 `477f492d70f21e2275096b8c14d097f975cd1755966bedc2d25c2fab283ad9d8`.
Archive CRC, operational scope, canonical-only SQLite snapshot and its quick_check
passed. Current database integrity, eight encrypted secret rows, shared database
modes, ADB directory mode and authentication boundaries passed. Four native
artifacts match manifest sizes and hashes; the served manifest and 17 checked
browser assets match the deployed tree.

Rollback to `fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8` remains available with its
images and backup; rollback was not exercised. No workstation enrollment,
physical display command or active announcement was exercised during acceptance.
