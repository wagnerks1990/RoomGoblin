# Android inventory delivery

PR #328 merged as `f76670b12306166b7f21d6fdcc2e5c122419beaf` after all 14 required
checks passed and review threads were resolved. Main Firefox then exposed the
[wizard route-fixture race](ubuntu-wizard-route-fixture.md). Its failed-job-only
retry passed, followed by exact-main image publication. Validate and Security
gates also passed. PR #329 carries the permanent fixture correction.

The normal backed-up Hub-only update completed at
2026-10-28T14:39:04.269127+00:00. The Hub reports the exact target revision; it and
the retained maintenance container are healthy with zero restarts. Maintenance
retains verified PR #323 and its 2026-10-28T12:17:19.978558272Z start time.
Host Agent, control/media health and runtime version 1.0.0-alpha.85 passed.
Production main is clean and the remaining component plan is empty.

Backup `auto-operational-2026-10-28T14-38-49-941Z.zip` is 129170487 bytes, mode 0600,
SHA-256 `095531f05167223301e624f5ad808b3df1ea5012607474d4f5eaaff440ff3f6f`.
Archive CRC, operational scope, canonical SQLite snapshot and its quick_check
passed. Current database integrity, eight encrypted secret rows, shared database
modes, ADB directory mode and authentication boundaries passed. Four native
artifacts match manifest sizes/hashes; the served manifest and 19 browser assets
match the deployed tree.

Rollback to `9de6079ea376cef71bd14ce7911c73bc1c0094f7` remains available with its
images and backup; rollback was not exercised. No workstation enrollment,
physical display command or active announcement was exercised during acceptance.
