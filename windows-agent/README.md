# RoomGoblin native Windows lab agent

This directory contains the native Windows service implementation of the RoomGoblin Lab Agent. The service runs as `LocalSystem`, uses the existing `C:\ProgramData\ClassroomControlHub\lab-agent.json` bearer-credential/DPAPI contract, and launches a one-shot user-session helper only for interactive operations such as lock and screenshot capture.

The validated Windows architecture consists of four executables:

- `RoomGoblinAgent.exe` — outbound WebSocket service and command dispatcher.
- `RoomGoblinSessionAgent.exe` — one-shot interactive-session helper.
- `RoomGoblinAgentBootstrap.exe` — migration/install/repair/uninstall bootstrap.
- `RoomGoblinAgentUpdater.exe` — health-gated staged updater with rollback.

Build with `windows-agent/scripts/Build-Native-Agent.ps1`. Production artifacts are intentionally not committed to Git. CI publishes them as workflow artifacts.

The legacy PowerShell scheduled-task agent remains a compatibility fallback during rollout. The native bootstrap disables it only after the native service connects successfully and restores it if migration fails.
