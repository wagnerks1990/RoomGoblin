# Native Windows Lab Agent

RoomGoblin's native Windows Lab Agent replaces the long-running PowerShell scheduled-task runtime with a Windows service while preserving the existing Hub protocol and credential model.

## Components

- `RoomGoblinAgent.exe` — delayed-auto LocalSystem service.
- `RoomGoblinSessionAgent.exe` — one-shot active-user helper for lock/screenshot operations.
- `RoomGoblinAgentBootstrap.exe` — install/repair/uninstall and migration rollback.
- `RoomGoblinAgentUpdater.exe` — verified staged update with health-gated rollback.

Installed binaries live under `C:\Program Files\RoomGoblin\Agent`. Existing identity/configuration remains under `C:\ProgramData\ClassroomControlHub\lab-agent.json` and uses Windows LocalMachine DPAPI.

## Existing endpoint migration

Build or obtain the four-file native package, then run the bootstrap elevated from the package directory:

```powershell
.\RoomGoblinAgentBootstrap.exe install
```

The bootstrap disables the legacy `RoomGoblin Agent` scheduled task, installs the `RoomGoblinAgent` Windows service, starts it, and waits for a fresh native health record. If the service does not connect successfully, the bootstrap removes the failed native service and restores the legacy scheduled task.

To remove the native service and restore the legacy task when it is still installed:

```powershell
.\RoomGoblinAgentBootstrap.exe uninstall
```

## Service checks

```powershell
Get-Service RoomGoblinAgent
sc.exe qc RoomGoblinAgent
sc.exe qfailure RoomGoblinAgent
Get-Content 'C:\ProgramData\ClassroomControlHub\native-service-health.json' -Raw
```

Expected production state is delayed automatic startup, LocalSystem service identity, and SCM restart recovery.

## Native updates

The RoomGoblin appliance packages the native executables under `/lab-agent/native/` and publishes `manifest.json` containing the release version and SHA-256 for the exact four files. The service verifies the allowlist and hashes before staging an update. If a trusted publisher thumbprint is configured, it also requires a valid Authenticode signature from that publisher.

The updater backs up the installed package, applies the staged files, restarts the service, and accepts the update only after a fresh health report for the expected version. Otherwise it restores the previous binaries.

## Interactive commands

Interactive desktop operations use a short-lived helper launched into the active WTS session. The service and helper communicate through a unique named pipe restricted to LocalSystem and the active user's SID, plus a random one-use authentication token.

The native command surface includes messages, power actions with cancellation, logoff, secure Windows lock, instructor lock, screenshot, approved presets, browser-history reporting, and agent update. Remote unlock and arbitrary application-lock execution are intentionally not provided.

## Live validation

The service architecture was validated on a real RoomGoblin Windows endpoint for connection/heartbeat, existing DPAPI credentials, Unicode username reporting, messages, screenshots, secure lock, instructor lock, logoff, DNS flush, browser history, restart/shutdown scheduling with cancellation, clean helper teardown, permanent service migration, SCM recovery, and legacy-task disablement.

See `docs/NATIVE-WINDOWS-LAB-AGENT.md` for the full architecture, security model, build process, and rollout contract.
