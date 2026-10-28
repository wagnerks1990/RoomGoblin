# Ubuntu repair and wizard delivery

PR #326 merged as `865631ddb27a3ad67f7560797fbce4739a882077` after all 14 checks
passed and review threads were resolved. Validate, Display browser regression,
Security gates and Publish Main Images passed for the exact merged commit.

The normal backed-up update completed at 2026-10-28T13:44:03.958610+00:00. Its
selective plan replaced only the Hub, which reports the exact target revision.
Hub and maintenance are healthy with zero restarts. Maintenance retained its
verified PR #323 container/revision and 2026-10-28T12:17:19.978558272Z start time.
Host Agent, control/media health and runtime version 1.0.0-alpha.85 passed.
Production main is clean and the remaining component plan is empty.

Backup `auto-operational-2026-10-28T13-43-50-144Z.zip` is 129127722 bytes, mode 0600,
SHA-256 `1adb7592c49fdd09f62ccb91420d52b98ebc1f08c864b72b6d49dc96156815d9`.
Archive CRC, operational scope, canonical-only SQLite snapshot and its quick_check
passed. Current database integrity, eight encrypted secret rows, shared database
modes, ADB directory mode and authentication boundaries passed. Four native
artifacts match manifest sizes and hashes; the served manifest and 19 checked
browser assets match the deployed tree.

Rollback to `312f753f67f8b2cb3b89ba3f7dd3f66da6af2e84` remains available with its
images and backup; rollback was not exercised. No workstation enrollment,
physical display command or active announcement was exercised during acceptance.
