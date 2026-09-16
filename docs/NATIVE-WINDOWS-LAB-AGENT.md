# Native Windows Lab Agent

RoomGoblin includes a native Windows service implementation of the Lab Agent under `windows-agent/`. It is intended to replace the PowerShell scheduled-task runtime after staged rollout while preserving the existing Hub protocol, enrollment credentials, and rollback path.

## Architecture

The native package contains four self-contained `win-x64` executables:

- `RoomGoblinAgent.exe` — Windows service running as `LocalSystem`. It maintains the outbound WebSocket connection, sends hello/heartbeat telemetry, dispatches constrained commands, collects browser history, and coordinates updates.
- `RoomGoblinSessionAgent.exe` — one-shot user-session helper. It is launched only when an interactive operation is required, such as secure workstation lock or screenshot capture.
- `RoomGoblinAgentBootstrap.exe` — install/repair/uninstall bootstrap. It migrates an existing RoomGoblin Lab Agent installation to the native service and performs health-gated rollback to the legacy scheduled task if migration fails.
- `RoomGoblinAgentUpdater.exe` — detached updater. It backs up the installed native binaries, applies the verified staged package, restarts the service, waits for a fresh health report for the expected version, and restores the backup if acceptance fails.

The production service name is `RoomGoblinAgent`; the display name is `RoomGoblin Agent`. It is installed as delayed automatic and SCM recovery restarts it after 5 seconds, 15 seconds, and 60 seconds.

## Credential compatibility

The native service deliberately preserves the existing configuration contract:

`C:\ProgramData\ClassroomControlHub\lab-agent.json`

Enrollment tokens and permanent agent credentials remain protected with Windows LocalMachine DPAPI. The Hub's existing one-time enrollment and permanent bearer credential model therefore remains valid; this rollout does not introduce per-device certificate identity.

The native service consumes a one-time enrollment token, accepts the existing `hello.ack` credential, saves the permanent credential with LocalMachine DPAPI, and clears enrollment material after successful enrollment.

## Interactive-session boundary

Windows services run in Session 0 and cannot safely interact with the student's desktop directly. RoomGoblin therefore uses a short-lived helper instead of running the entire agent in the user session.

For each interactive request the service:

1. discovers the active WTS session;
2. reads the user SID;
3. creates a unique named pipe;
4. grants pipe access only to LocalSystem and the active user SID;
5. generates a random 256-bit one-use authentication token;
6. obtains the WTS user token and launches `RoomGoblinSessionAgent.exe` with `CreateProcessAsUser` on `winsta0\default`;
7. authenticates the helper over the pipe using fixed-time token comparison;
8. sends one request and receives one response;
9. allows the helper to exit.

The WTS username query explicitly binds `WTSQuerySessionInformationW` and decodes Unicode, preventing the garbled-user regression found during live testing.

## Supported command surface

The native agent preserves the constrained RoomGoblin command contract:

- message;
- restart;
- shutdown;
- cancel shutdown;
- logoff;
- Windows secure lock;
- instructor lock using the Windows secure lock screen;
- screenshot;
- approved presets: Group Policy update, DNS flush, network renew, system information;
- browser-history refresh/reporting;
- native agent update.

`instructor-unlock` remains deliberately unsupported because Windows secure lock should be released by Windows authentication. `app-lock` and `app-unlock` remain deliberately unsupported by this constrained agent; managed kiosk/AppLocker policy or Veyon should own that control plane.

## Browser history

Browser-history collection uses embedded `Microsoft.Data.Sqlite` and reads snapshots of Chrome, Edge, and Firefox history databases. Chromium WAL/SHM sidecars are copied when present. A locked or corrupt profile is isolated so one profile cannot prevent all history collection.

The Hub remains the authority for browser-history retention and access control. The native agent only collects and reports records when instructed.

## Native update trust

The appliance image cross-builds the four Windows executables from the same repository revision and `VERSION` file. The exact packaged files are exposed under:

`/lab-agent/native/`

The image generates `/lab-agent/native/manifest.json` containing the RoomGoblin version, exact allowed filenames, byte lengths, and SHA-256 hashes.

Before an update is staged, the Windows service:

- accepts only the four allowlisted native filenames;
- requires valid 64-character SHA-256 values;
- downloads each file from the same Hub origin;
- verifies each SHA-256;
- optionally verifies Authenticode with WinVerifyTrust when `trustedPublisherThumbprint` is configured;
- launches the updater from outside the install directory.

The detached updater keeps rollback copies and accepts an update only after the restarted service reports a fresh health record for the expected version.

Unsigned builds are valid for development/testing. Production environments that require publisher trust should sign the four executables with their approved code-signing identity and configure the trusted publisher thumbprint. Signing improves provenance; it is not a guarantee that endpoint security products will never flag a build.

## Legacy compatibility and rollback

The PowerShell scheduled-task agent remains in the repository during migration. For an existing installation, `RoomGoblinAgentBootstrap.exe install`:

1. verifies the four native binaries are present;
2. requires the existing `lab-agent.json` configuration;
3. stops and disables the legacy `RoomGoblin Agent` scheduled task when it exists;
4. installs the native binaries under `C:\Program Files\RoomGoblin\Agent`;
5. creates the delayed-auto service and recovery policy;
6. starts the native service;
7. waits for a fresh native health report.

If the native service fails acceptance, the bootstrap removes it, re-enables the legacy task, and starts the legacy agent again. `uninstall` similarly restores the legacy task when available.

Do not remove the legacy package until the native rollout and upgrade path have been accepted across the intended fleet.

## Build

On Windows with .NET 8 SDK:

```powershell
.\windows-agent\scripts\Build-Native-Agent.ps1
```

The script reads the repository `VERSION`, publishes all four self-contained `win-x64` single-file executables, and stamps the native assembly informational version from the same release value used by RoomGoblin.

GitHub Actions also builds the native package on `windows-latest`. The main Docker image cross-builds the same projects with .NET 8 and packages them under `public/lab-agent/native`.

## Validated live behavior

The release-candidate architecture was validated on a real RoomGoblin-managed Windows endpoint before repository integration. Acceptance included:

- native service connection and heartbeat;
- existing bearer credential and LocalMachine DPAPI compatibility;
- correct Unicode domain/user reporting;
- message delivery;
- screenshot capture and Hub display;
- Windows lock and instructor lock;
- logoff;
- DNS-flush preset;
- browser-history collection and Hub display;
- restart scheduling plus cancellation;
- shutdown scheduling plus cancellation;
- helper process teardown after interactive requests;
- permanent migration to `C:\Program Files\RoomGoblin\Agent`;
- delayed-auto service startup and SCM recovery policy;
- disabling of the legacy scheduled task after successful migration;
- no RoomGoblin application errors during acceptance.

These results validate the architecture and command contract used by the repository implementation. Future release builds still require CI and rollout acceptance because compiler/runtime/package changes can alter executable behavior.

## Security boundaries

- The service makes outbound connections to its configured Hub; it does not expose a new inbound listener.
- Lab Agent commands remain constrained to the RoomGoblin command contract; there is no arbitrary shell endpoint.
- Do not add broad Defender/EDR exclusions as a deployment requirement.
- Keep enrollment tokens short-lived and one-time.
- Keep permanent credentials DPAPI-protected at rest.
- Keep browser-history and screenshot access behind existing sensitive-data capabilities and retention controls.
- Keep interactive work in the one-shot session helper instead of moving the whole service into a user session.
- Do not weaken the named-pipe ACL or per-request random token.
- Do not silently turn instructor lock into a custom credential bypass.
