# Native Windows Enrollment

RoomGoblin recommends the native Windows service for new Lab Agent enrollments. The legacy PowerShell scheduled-task installer remains available as a compatibility fallback during rollout.

## Create an installer

From the RoomGoblin controller, open the Windows Lab Agent enrollment controls, enter the stable computer ID, choose the short enrollment lifetime, and select **Create One-Time Installer**.

The result shows a **Recommended: native Windows service installer** command. Run that command once in **Windows PowerShell as Administrator** on the target computer.

## Verification performed by the command

Before any native executable runs, the generated command:

- downloads `/lab-agent/native/manifest.json` from the same RoomGoblin origin;
- requires exactly the four expected native package filenames;
- downloads those four files to a unique temporary directory;
- computes SHA-256 for each download;
- compares every hash with the manifest;
- stops immediately if a file is missing, duplicated, or does not match its expected hash;
- invokes `RoomGoblinAgentBootstrap.exe install` only after package verification.

The four files are `RoomGoblinAgent.exe`, `RoomGoblinSessionAgent.exe`, `RoomGoblinAgentUpdater.exe`, and `RoomGoblinAgentBootstrap.exe`.

If RoomGoblin is intentionally deployed over HTTP on a trusted classroom network, the generated command includes the bootstrap's explicit `--allow-http` acknowledgement. HTTPS does not require that switch.

## Endpoint security boundary

The bootstrap requires the Hub URL, agent ID, and one-time token together. It DPAPI-protects the enrollment token before writing the compatibility configuration and restricts that configuration to `SYSTEM` and local `Administrators`. Native service health must become fresh before installation is accepted.

If fresh enrollment fails native health acceptance, the newly created enrollment configuration is removed. Existing enrolled endpoints continue to use their current DPAPI-protected configuration during native migration or repair.

## Legacy fallback

The enrollment result also contains a collapsed **Legacy PowerShell scheduled-task installer** section. Use it only when a native rollout issue requires the compatibility path. Existing API consumers still receive the historical `installCommand`, so this UI change does not break earlier tooling.

Do not retire the fallback until reboot persistence, native self-update, uninstall/legacy restoration, and representative fleet acceptance are complete.


## Live first-time enrollment acceptance

On 2026-09-17 a Windows endpoint with no active compatibility config completed true first-time native enrollment against the production RoomGoblin alpha.83 package. The one-time token was exchanged for a DPAPI-protected permanent credential, enrollment token fields were cleared, the config ACL remained restricted to SYSTEM and Administrators, all four installed binaries exactly matched the server manifest, and the LocalSystem service remained running after controlled restart/stability verification.

SentinelOne flagged the interactive PowerShell installer chain and quarantined related copies. The verified installed files remained present and usable. Do not respond by disabling EDR or adding broad exclusions; prefer signed-publisher or exact-release-hash policy and the hardened deployment path tracked in the repository.
