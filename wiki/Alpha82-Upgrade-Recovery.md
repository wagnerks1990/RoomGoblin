# Alpha.82 upgrade and recovery corrections

The live alpha.76-to-alpha.81 upgrade exposed gaps that startup-only CI missed.

| Failure | Correction |
| --- | --- |
| Host Agent `226/NAMESPACE` | Provision `/var/lib/classroom-hub`; systemd also creates it using `StateDirectory`. |
| Legacy Android signing pair rejected | Recognize `ClassroomHub-Display-Agent.keystore`, preserve key/password bytes, and reject conflicting identities. |
| Maintenance cannot read ADB trust | Installer/updater set the owned volume to `10001:10001`, directory `0750`, keys `0640`. Restore normalizes active permissions after validating historical manifests. |
| SQLite export denied | Backend sets database and WAL/SHM to `0660` before initialization and after migration. Recreated sidecars inherit database permissions. Unrelated secrets retain the `0077` process umask. |

GID 10001 is the trusted application/maintenance group; do not add host users.
Restored signing files remain root-owned and private to maintenance (0700/0600),
including when older authenticated manifests recorded application ownership.
Do not grant world access, disable container hardening, delete volumes, or
regenerate signing/ADB keys to repair these failures.

## Acceptance

Retain a successful encrypted `.rgbak` export, its passphrase separately, and the
installer rollback snapshot. Recovery passphrases require localhost through an
SSH tunnel or supported HTTPS. After the exact commit's validated images are
published, follow the standard Git upgrade using `install.sh`.

Require backend, maintenance and Host Agent version convergence. Check saved
accounts, schedules, devices, assets and integrations; export again after a
restart. Test import on an isolated compatible host that cannot control live
classroom devices. Successful export alone does not prove complete recovery.

The live alpha.81 system and export succeeded only after manual workarounds.
Alpha.82 adds regression coverage for pre-rebrand identity migration/conflicts
and database reopen/WAL recreation. Physical hardware acceptance and an
operator-owned complete restore drill are not implied by CI results.
