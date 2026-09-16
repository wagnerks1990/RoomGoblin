# AI contract: native Windows Lab Agent

Use this file as the implementation contract for changes involving `windows-agent/`, Windows Lab Agent packaging, native updates, or migration from the legacy scheduled-task agent.

## Invariants

- The native production service is `RoomGoblinAgent` and runs as `LocalSystem` in Session 0.
- Keep the existing `C:\ProgramData\ClassroomControlHub\lab-agent.json` compatibility contract unless an explicit migration is implemented and tested.
- Existing one-time enrollment tokens and permanent bearer credentials are valid native-agent identity. Permanent credentials remain Windows LocalMachine DPAPI protected. Do not introduce per-device certificate identity unless requirements explicitly change.
- The service must remain outbound-only. Do not add a workstation-side inbound control listener.
- The service must not become an arbitrary shell/RMM executor. Preserve the allowlisted RoomGoblin command surface.
- Interactive operations must use the one-shot `RoomGoblinSessionAgent.exe` bridge. Do not move the long-running service into a user session.
- Session bridge pipes must remain unique per request, ACLed to LocalSystem plus the active user's SID, and authenticated with random per-request secret material compared in fixed time.
- Preserve the explicit Unicode WTS binding (`WTSQuerySessionInformationW`). A change that reintroduces ANSI/Unicode ambiguity can corrupt domain/user reporting.
- `instructor-unlock` is intentionally rejected. Windows secure lock is released through Windows authentication, not a RoomGoblin bypass.
- `app-lock` / `app-unlock` are intentionally rejected by this constrained agent unless a separately designed managed-policy control plane is introduced.
- Browser history is optional sensitive telemetry. A single locked/corrupt browser database must not terminate the service or prevent other profiles from reporting.
- Screenshots remain bounded to the current safe payload limit and must be captured in the interactive session rather than Session 0.

## Version authority

`VERSION` is the release authority. Native builds must not hardcode `1.0.0-alpha.*` in source. `Build-Native-Agent.ps1`, Docker cross-builds, and CI pass the repository version as assembly `Version` / `InformationalVersion`. Health reports and update acceptance use that native informational version.

## Update contract

Production native artifacts are packaged under `public/lab-agent/native/` by the Docker build. The image generates `manifest.json` from the exact four packaged executables.

The only accepted update files are:

- `RoomGoblinAgent.exe`
- `RoomGoblinSessionAgent.exe`
- `RoomGoblinAgentBootstrap.exe`
- `RoomGoblinAgentUpdater.exe`

The service must verify manifest shape, filename allowlist, SHA-256, and—when configured—Authenticode publisher trust before staging. Do not accept extra arbitrary manifest files. Do not skip health-gated updater rollback.

`RoomGoblinAgentUpdater.exe` runs from outside the install directory, backs up the current binaries, replaces the package, starts the service, and requires a fresh health record for the expected version. Failure restores the backup and restarts the previous service.

## Migration contract

The legacy PowerShell scheduled-task agent remains a compatibility fallback during rollout.

`RoomGoblinAgentBootstrap.exe install` for an existing endpoint must:

1. require the existing configuration;
2. stop/disable the legacy task only as part of the native migration;
3. copy all four native binaries to `C:\Program Files\RoomGoblin\Agent`;
4. create the delayed-auto service and SCM recovery policy;
5. start the service and wait for fresh native health;
6. restore/restart the legacy task if native acceptance fails.

Do not delete the legacy installation or its credential/config as part of a migration that still relies on rollback.

## Live acceptance baseline

The architecture has been validated on a real endpoint for message, screenshot, lock, instructor lock, logoff, browser history, preset execution, restart/shutdown scheduling and cancellation, Unicode username reporting, helper teardown, permanent service migration, and legacy-task disablement. Treat these as regression surfaces.

## CI expectations

Changes under `windows-agent/**`, Docker native packaging, or `VERSION` must keep the Windows native-agent workflow green. Node source regressions should also verify source presence, version authority, session-bridge security invariants, update hashing/signature hooks, rollback, Docker packaging, and deliberate command refusals.

## Security guidance

Do not solve endpoint-security false positives by requiring broad antivirus exclusions. Prefer stable native service behavior, constrained capabilities, reproducible CI artifacts, publisher signing where available, and normal enterprise allowlisting based on signed publisher/hash policy.
