# Windows legacy task-state delivery

PR #322 merged as `ea648350e200e8f6130ae533d0fb7600790b0d82` after all 14 PR checks passed and all review
threads were resolved. Validate, Display browser regression, Security gates and
Publish Main Images passed on that exact main commit before deployment.

The normal backed-up updater completed at 2026-10-28T11:50:34.549242+00:00. Its conservative plan
required full Hub, maintenance and Host Agent reconciliation. Both containers
were recreated, carry the exact commit revision, report healthy and have zero
restarts. The Host Agent and both HTTP planes are healthy at 1.0.0-alpha.85.
The production main checkout is clean and the post-update plan has no remaining
component changes.

The backup `auto-operational-2026-10-28T11-50-00-903Z.zip` is 129066844 bytes, mode 0600,
with SHA-256 `c0fd6585c4e2e5c4f6ec576cba39cb45cd9d9e3b0529fcd6b7becaa13d3dfca6`.
Archive CRC, operational scope, canonical-only SQLite snapshot and snapshot
quick_check passed. The current database quick_check, all eight encrypted secret
rows, shared database modes, ADB identity directory mode and authentication
boundaries passed. Four packaged native files match their manifest sizes and
SHA-256 hashes; the served manifest and 14 browser assets match the deployment.

Rollback to `395cb88f4a135ea6b990458d8c53e520d282e5a3` remains available with its images and matching
backup. Rollback was not exercised. No classroom display, workstation service or
scheduled task was installed, restarted or controlled during acceptance.
