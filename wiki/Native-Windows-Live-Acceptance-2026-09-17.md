# Native Windows Lab Agent live acceptance — 2026-09-17

Production-backed acceptance on a real RoomGoblin-managed Windows endpoint completed the following rollout checks:

- production-served native package migration/repair;
- `RoomGoblinAgent` running as `LocalSystem` from `C:\Program Files\RoomGoblin\Agent`;
- reboot persistence with fresh `native-windows-service` health;
- legacy `RoomGoblin Agent` scheduled task remaining disabled while native is accepted;
- SCM restart recovery retained at 5s / 15s / 60s;
- native self-update through the deployed manifest and `update-agent` action;
- native bootstrap uninstall;
- removal of the native service/install directory;
- restoration and execution of the legacy scheduled-task agent;
- preservation of `C:\ProgramData\ClassroomControlHub\lab-agent.json`.

During legacy restoration, Task Scheduler result `267009` (`0x41301`) was observed while the task state was `Running`; this is the Task Scheduler "task is currently running" status, not a completed task failure.

The remaining live acceptance gap is first-time native enrollment on a computer with no existing `lab-agent.json` using the controller-generated verified native enrollment command. Authenticode enforcement also remains environment-specific and requires a configured trusted publisher identity.

See `docs/NATIVE-WINDOWS-LIVE-ACCEPTANCE-2026-09-17.md` in the repository for the full evidence record and operational notes.
