# Ubuntu reliability delivery

PR #324 merged as `fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8` after all 14 checks
passed and review threads were resolved. Validate, Display browser regression,
Security gates and Publish Main Images passed for that exact merged commit.

The normal backed-up update completed at 2026-10-28T12:36:44.603972+00:00. The
reviewed selective plan replaced only the Hub, which reports the exact target
revision and is healthy with zero restarts. Maintenance retains its verified
PR #323 container, revision and 2026-10-28T12:17:19.978558272Z start time. Host Agent,
control/media health and runtime version 1.0.0-alpha.85 passed. Production main
is clean; the post-update component plan is empty.

Backup `auto-operational-2026-10-28T12-36-30-761Z.zip` is 129093653 bytes, mode 0600,
SHA-256 `bdedf63576f397f5a6fa61f6e1c3989dd3677e826f6ce8d3af345807f865c06b`.
Archive CRC, operational scope, canonical-only SQLite snapshot and its quick_check
passed. Current database integrity, eight encrypted secret rows, shared database
modes, ADB identity directory mode and authentication boundaries passed. Four
native artifacts match manifest sizes and hashes; the served manifest and all
17 checked browser assets match the deployed tree.

Rollback to `7acaa7a1c725a53494ef5409a1d47d8792d9ad24` remains available with its
images and backup; rollback was not exercised. No workstation or physical
classroom display was installed, restarted or controlled during acceptance.
