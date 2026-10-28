# Sports durability delivery

PR #338 merged as `bdf521c2a5739f8e8c9645fb3428ad46744f3714` after all
14 PR checks. Validate, Display browser regression and Security gates passed on
that exact main commit. Publish Main Images passed on its second attempt after
a failed-jobs-only retry of a registry `unknown blob` error; no gate was bypassed.

The normal backed-up updater completed on 2026-10-28 at 18:59 UTC. The Hub
revision matches the selected commit. The independently verified selective plan
retained unchanged maintenance and Host Agent components. The checkout is clean
on main and a fresh plan requires no further reconciliation.

Verification passed control/media readiness, maintenance/Host Agent health,
database quick-check, decryption of all eight stored secrets, database and ADB
identity permissions, and maintenance-token authorization boundaries. All 27
checked public assets match source; the two Sports and six maintenance Android
modules, four native Windows artifacts and persistent signed Android artifact
also passed their identity checks. Both running containers have zero restarts.

The new operational backup is 129,473,966 bytes. Its SHA-256 is
`b6abacb3dd6177aea3960af35a9d2d9d892c35c5e2a6fa7bd42c674f0d395d63`.
The archive passed CRC, manifest, canonical-database-only and SQLite integrity
checks. Rollback remains available to `f588de3b138429127dfaed2beb1bc558db1b9b47`
with both previous images retained. No physical display, routing or playback
commands were issued.
