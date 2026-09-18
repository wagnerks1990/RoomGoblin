# Veyon Windows endpoint pilot

RoomGoblin's Windows-only terminal process launch and Internet Guard firewall
backend require a complete matching Veyon 4.11.2 Windows build. The successful
Linux pilot proves source compilation and controller feature discovery only; it
does not make those endpoint workers available on Windows.

This pilot uses Veyon's complete MinGW/Qt build and upstream NSIS installer. It
never supports copying individual DLLs into an existing Veyon installation.
Core, Qt libraries, runtime dependencies and every plugin are one ABI-matched
unit. No paid Veyon add-on, trial binary or license bypass is included.

## Build boundary

Run `tools/package-veyon-pilot-windows.sh NEW_WORK_DIRECTORY` only in a reviewed
x86-64 Veyon MinGW/Qt cross-build environment. The script requires the matching
Qt `qt-cmake` under `/usr/x86_64-w64-mingw32` by default; an alternate reviewed
path can be supplied with `VEYON_MINGW_PREFIX` or `VEYON_QT_CMAKE`. It:

1. prepares exact upstream Veyon revision
   `afecfd6cbf78efa34da80acb7ea449001574e8cc`;
2. inserts the GPL community plugin source and log-redaction patches;
3. builds the complete Windows runtime through upstream's `windows-binaries`
   target;
4. requires all community DLLs and validates x86-64 PE metadata (while allowing
   NSIS's x86 bootstrap for the complete win64 installer);
5. creates the complete upstream-style NSIS installer;
6. retains corresponding source, GPL/provenance files and SHA-256 sums.

`plugins-built.txt` is build-tree evidence. `features-expected.txt` is an
acceptance checklist, not runtime discovery. Runtime discovery must be captured
from `veyon-cli plugin list` and `veyon-cli feature list` on Windows.

The official Veyon CI cross-toolchain image is not mirrored or publicly pinned
by RoomGoblin. Do not substitute an arbitrary compiler/Qt image merely to make a
build pass. A Windows artifact is not published by normal RoomGoblin CI until a
reviewed, immutable toolchain source is available.

## One-computer deployment gate

Use a disposable or snapshotted Windows 10/11 test computer. Before starting,
retain the exact known-good Veyon installer already used by that endpoint. Its
SHA-256 hash is a required rollback input.

From an elevated Windows PowerShell session:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\test-veyon-windows-pilot.ps1 `
  -PilotInstaller C:\Pilot\veyon-4.11.2.0-win64-setup.exe `
  -PilotSha256 '<64-hex pilot hash>' `
  -RollbackInstaller C:\Pilot\veyon-4.11.0.0-win64-setup.exe `
  -RollbackSha256 '<64-hex rollback hash>' `
  -BackupDirectory C:\Pilot\rollback-evidence `
  -AcceptDisposablePilotRisk
```

The wrapper refuses a reused backup directory, non-administrator execution,
hash mismatch, missing existing Veyon CLI or non-64-bit Windows. It exports the
current Veyon configuration and inventories current plugins/features before
installation. It restricts the evidence directory to SYSTEM and Administrators,
uses the documented silent NSIS switches, preserves an existing Master (or adds
it only with `-IncludeMaster`) and retains Veyon's standard Interception
component. If CLI acceptance fails, it
removes only `RoomGoblinVeyonIG_*` firewall rules, installs the verified rollback
package, imports the saved configuration and requires `VeyonService` to run.

This is not protection against power loss during installation. A VM snapshot or
equivalent endpoint rollback remains mandatory. The script does not deploy to a
computer list and must not be converted into classroom-wide distribution until
one endpoint passes the complete acceptance checklist.

## Live acceptance

After CLI discovery passes:

- verify ordinary Veyon monitoring/control still works;
- test chat and restricted file browsing with non-sensitive sample data;
- test clipboard send/read and the fixed key-sequence controls;
- open CMD and Windows PowerShell separately, confirm `whoami`, then test close,
  expiry, output truncation, disconnect and disabled-feature refusal;
- test Internet Guard block, manual allow and 15-minute automatic release while
  inspecting only `RoomGoblinVeyonIG_*` firewall rules;
- restart Veyon during an Internet Guard test and use the documented exact-rule
  cleanup if the in-process timer cannot run;
- confirm no terminal commands, output, clipboard data, chat, file bytes,
  credentials or private connection identifiers appear in Hub or Veyon logs.

Record each capability as working, failed or uncertain. An accepted WebAPI
dispatch or advertised feature is not proof of endpoint behavior.

## Rollback

For any unexpected behavior, first remove only the RoomGoblin pilot firewall
rules, then run the retained known-good installer silently and import the saved
configuration. Finally verify `VeyonService`, plugin inventory, remote view and
authentication. Restore the snapshot if installer rollback or configuration
validation is uncertain. RoomGoblin application rollback never rolls back native
Veyon binaries.
