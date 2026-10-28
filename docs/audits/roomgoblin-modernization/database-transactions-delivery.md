# Database transaction delivery

PR #340 merged as `8357bec099c0a9acf0241519d7b2028ce4eee126` after all
15 PR checks. Validate, Display browser regression, Security gates and Publish
Main Images passed for that exact main commit before deployment.

The normal backed-up updater completed on 2026-10-28 at 19:39 UTC. Its plan
required full service reconciliation because storage inputs changed. Both Hub
and maintenance now carry the exact new revision. Clean main, an empty follow-up
plan, control/media/maintenance/Host Agent health and zero container restarts pass.

Verification passed database integrity, decryption of all eight stored secrets,
shared database/ADB modes and maintenance authorization boundaries. All 27 checked
served assets, six Hub modules, six maintenance Android modules, four native
Windows artifacts and the signed Android artifact match expected identities.

The new operational backup is 129,497,761 bytes with SHA-256
`3aa8c5d2ee796f95233a1cf644261e4343f00fb3d945b4f4fb38258d3c185e93`.
Archive CRC, manifest, canonical database selection and SQLite integrity passed.
Previous deployment `770d7a720f825de067ddfd5b81edf77847a09c24` and its rollback
images remain available. No production credential changes, legacy imports or
physical classroom commands were exercised for validation.
