# Veyon live terminal pilot

RoomGoblin can open a short-lived **CMD** or **Windows PowerShell** session on one
Windows lab computer from the Veyon controller page. This is original
RoomGoblinWebBridge feature-plugin code. It uses Veyon's authenticated
`FeatureMessage` path and unmanaged signed-in-user session worker; it does not
install or contact WinRM, SSH, MeshCentral, the RoomGoblin Windows Lab Agent, or
another endpoint service.

This is a privileged experimental tool, not a claim that stock Veyon includes a
web terminal. It requires an enabled RoomGoblin administrator account, the exact
matching RoomGoblinWebBridge build on teacher and endpoint, and Veyon's existing
authentication/access rules. The shell runs with the signed-in user's token. It
does not request UAC elevation, run as SYSTEM, save credentials, or become
persistent.

## Browser use

1. Open **Veyon**, select exactly one disposable Windows test PC, and choose
   **Live terminal**.
2. Enter `cmd` or `powershell`, confirm the named target, and wait for Connected.
3. Start with read-only commands such as `whoami`, `hostname`, `Get-Date`, and
   `Get-Process | Select-Object -First 5`.
4. Close the dialog when finished. Hiding the page also requests cleanup.

Each session has a hard ten-minute lifetime. Input is limited to 4096 UTF-8 bytes
per submission, output is retained only in memory and capped at 128 KiB, and no
command or output content is written to the RoomGoblin audit log. The audit trail
records only open/close lifecycle, target and selected shell. The browser renders
output as text, never HTML.

This first pilot is a streamed command session, not a ConPTY terminal emulator.
It does not currently provide terminal resize, ANSI emulation, interactive UAC,
full-screen console programs, password prompting safeguards, Ctrl+C, or reliable
support for programs that require a real console. Use the existing browser remote
control for those interactions.

## API boundary

The only HTTP surface is:

`POST /api/v1/veyon/computers/:id/terminal/{open,state,read,write,close}`

It is isolated from the ordinary teacher browser-session route and guarded by
`requireAdmin`. Authorization is checked again after native connection work and
before results are returned. A session is bound to its administrator, saved
computer identity and exact Veyon connection. Requests are typed; callers cannot
supply a program path, feature UUID or transport target. Delivery is not retried
after uncertainty, disconnect or restart.

The native server binds the opaque terminal context to the authenticated Veyon
`MessageContext`, admits one endpoint shell worker at a time, requires monotonic
input sequence numbers and forwards replies only to that same context. Disabling
the `RoomGoblinTerminal` feature UUID in Veyon disables advertisement and use.

## Build and acceptance status

The source is included in the pinned Veyon 4.11.2 pilot and the Linux build gate
verifies feature registration. The actual process launch is Windows-only. A Linux
worker returns an explicit unavailable response. Windows ABI/build and live lab
operation are not proven until the entire matching Veyon tree is built with the
Windows toolchain and tested on disposable teacher/student VMs.

Acceptance requires checking both `cmd` and `powershell`, identity with `whoami`,
plain-text rendering, output truncation/reset, close and ten-minute expiry,
disconnect behavior, disabled-feature refusal, role revocation, and confirmation
that no command/output appears in Hub or native debug logs. Test destructive or
state-changing commands only on revertible VMs.

To disable the pilot immediately, disable the `RoomGoblinTerminal` feature in
Veyon or remove the matching pilot plugin package and restart native Veyon
services using the platform's normal package/service procedure. A Hub rollback
does not roll back native Veyon binaries.
