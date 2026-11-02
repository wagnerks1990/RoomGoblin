# Windows monitoring delivery

PR #318 merged after all 14 checks passed and both review threads were resolved.
Exact main commit: `5e1af236aa28a2250d1f210d9ec8ac41422267ce`.

Main Chromium initially failed the account-dialog keyboard focus case. The
unchanged browser rerun passed; its separately reproduced source repair is in
PR #319. Validate, Security gates, Display browser regression and Publish Main
Images all passed for this exact commit before deployment.

The normal backed-up updater completed at `2026-10-28T10:12:53Z`. Fresh planning
selected only the Hub; maintenance retained its existing healthy container and
the native Host Agent remained healthy. The checkout is clean on main, the Hub
revision label matches the exact commit, and post-update planning is a no-op.

Backup: `auto-operational-2026-10-28T10-12-40-622Z.zip`, 128,987,393 bytes, mode 0600.
SHA-256: `4d4509b428c20ef5eabc01a351e2fd1a4728c99255936910291a253d40ce91bc`.
Archive CRC, canonical database-only scope and extracted SQLite quick_check pass.
Rollback to `1a005b25624575632df6017d4018e77a014449d9` and matching backup is available;
rollback was not exercised.

Read-only acceptance passes control/media readiness, maintenance/Host Agent
health, database integrity and shared modes, all eight encrypted secret records,
authentication boundaries, the preserved ADB identity mode and 13 served asset
hashes. No physical classroom capture/control, workstation enrollment or live
fault injection was performed. These checks do not replace physical acceptance.
