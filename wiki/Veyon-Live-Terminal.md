# Veyon live terminal pilot

RoomGoblin provides an experimental administrator-only CMD or Windows PowerShell
session for one Windows lab PC. It is original RoomGoblinWebBridge feature-plugin
code transported entirely through Veyon's authenticated feature/worker channel.
It does not use WinRM, SSH, MeshCentral, the Windows Lab Agent, or another endpoint
service.

The shell runs as the signed-in user without UAC elevation or SYSTEM rights. A
session expires after ten minutes, accepts at most 4096 UTF-8 bytes per input,
and retains at most 128 KiB of output in memory. Command and output content are
not audited; only open/close lifecycle, target and shell are recorded.

Select exactly one disposable Windows test PC on **Veyon**, choose **Live
terminal**, then select `cmd` or `powershell`. Start with `whoami`, `hostname`,
`Get-Date`, or another read-only command. Close the dialog when done.

This is a streamed command session, not a ConPTY emulator. Terminal resize, ANSI
emulation, Ctrl+C, interactive UAC and full-screen console programs are outside
the first pilot. The endpoint feature is Windows-only. Linux compilation verifies
registration, but a matching Veyon 4.11.2 Windows build and disposable-VM/live-lab
acceptance remain required before production rollout.

See `docs/VEYON-LIVE-TERMINAL.md` in the repository for the full security, API,
build, acceptance and recovery contract.
