# Windows agent and account-focus delivery

PR #319 passed all 14 final checks and merged as
`0f24c99394bb4bd9dbaed887e94cb3b6a81b0436`. Native process cases also passed the
required .NET 8 Windows job. All required main workflows and the exact Hub/
maintenance image pair passed before deployment.

The initial preflight expected a Hub-only update and stopped without mutation.
The conservative planner correctly required full reconciliation for native-agent
and CI inputs. Its decision was preserved; a fresh full preflight passed, and
the normal backed-up update completed at `2026-10-28T10:43:44Z`.

Both healthy container revision labels match the selected commit, the native
Host Agent is healthy, source is clean on main and the post-update plan is a no-op.
Read-only acceptance also passes control/media readiness, database integrity and
shared modes, all eight encrypted secret records, authentication boundaries, ADB
identity mode, 14 served asset hashes and all four native executable hashes plus
the served package manifest. Native artifacts were verified; no workstation
agent was installed, restarted, enrolled or commanded.

Backup: `auto-operational-2026-10-28T10-42-22-126Z.zip`, 129,008,944 bytes, mode 0600.
SHA-256: `3359381a6bed80b073c7d6bec8055517393aff3d149c2df878d55388478afe77`.
Archive CRC, canonical database-only scope and extracted SQLite quick_check pass.
Rollback to `5e1af236aa28a2250d1f210d9ec8ac41422267ce` is available and was not
exercised. No classroom capture/control or live fault injection was performed.
