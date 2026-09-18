# RoomGoblin native Windows lab agent

This directory contains the native Windows service implementation of the RoomGoblin Lab Agent. The service runs as `LocalSystem`, uses the existing `C:\ProgramData\ClassroomControlHub\lab-agent.json` bearer-credential/DPAPI contract, and launches a one-shot user-session helper only for interactive operations such as lock and screenshot capture.

The validated Windows architecture consists of four executables:

- `RoomGoblinAgent.exe` — outbound WebSocket service and command dispatcher.
- `RoomGoblinSessionAgent.exe` — one-shot interactive-session helper.
- `RoomGoblinAgentBootstrap.exe` — migration/install/repair/uninstall bootstrap.
- `RoomGoblinAgentUpdater.exe` — health-gated staged updater with rollback.

Build with `windows-agent/scripts/Build-Native-Agent.ps1`. Production artifacts are intentionally not committed to Git. CI publishes them as workflow artifacts.

The legacy PowerShell scheduled-task agent remains a compatibility fallback during rollout. The native bootstrap disables it only after the native service connects successfully and restores it if migration fails.

## Security and resource boundaries

- All native `ClientWebSocket` writes share one send gate; heartbeat, history, screenshot, and command-result frames cannot overlap.
- One-use enrollment files are limited to 64 KiB and installation fails if the bearer-token file cannot be deleted after reading. Atomic configuration replacement removes the old backup so a legacy plaintext token cannot remain there.
- Native update manifests allow exactly the four package executables, bound each file and the aggregate package size, verify the declared byte count and SHA-256, and optionally pin either the publisher certificate's SHA-1 or SHA-256 digest. The Windows service `ImagePath` is quoted for the default path under Program Files.
- Browser-history collection has a 30-second operation budget, bounded database/profile counts and field lengths, and rejects oversized/reparse-point databases. Screenshot quality, dimensions, encoded response size, and alert identifiers are bounded.
- The PowerShell compatibility agent accepts only `http`/`https` Hub origins, does not discover a SYSTEM-level `sqlite3.exe` through `PATH`, bounds returned native output, and preserves native-service state when its scheduled-task fallback is uninstalled.
