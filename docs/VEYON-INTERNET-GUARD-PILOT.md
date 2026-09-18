# Windows Internet Guard browser pilot

RoomGoblin includes a GPL-2.0-only source port of
`lellomele/veyon-internet-guard` for the exact pinned Veyon 4.11.2 pilot. The
upstream release binary targets Veyon only through 4.10.x and must not be copied
into 4.11.2. RoomGoblin builds the source as part of the matching Windows pilot
instead. This component is Windows-only and is not present in the Linux artifact.

The Veyon controller page exposes **Block Internet — 15 minutes** and **Allow
Internet now** for selected computers only when the exact `InternetGuard` feature
UID is advertised. Commands require `lab.control`, use the bounded Veyon command
queue and are never retried after uncertain delivery. Advertisement proves only
that the appliance plugin loaded; verify the endpoint directly.

## Behavior and limits

The endpoint adds eight named outbound Windows Firewall rules for TCP 80/443/53,
UDP 53/443, TCP/UDP 853, and TCP 3128/8080/8443. This blocks common web, DNS,
QUIC, DNS-over-TLS and proxy traffic. It also blocks matching services on the
local network. It does **not** block every VPN, tunnel, custom port, cached site,
or non-IP path and must not be described as exam-grade isolation.

The port refuses to enable Windows Firewall if the active Windows profile is
disabled. Rule creation is transactional: if any rule fails, all RoomGoblin pilot
rules are removed. A successful block starts a 15-minute in-process release
timer. A Veyon service or computer crash can prevent that timer from firing and
leave persistent Windows Firewall rules, so testing requires the recovery command
below and a disposable endpoint or snapshot.

## Prepare a matching Windows build

Build the complete pinned pilot on a disposable Windows build VM using the
official Veyon 4.11.2 Windows dependencies and MinGW/Qt versions; do not copy an
older Internet Guard DLL into 4.11.2. From the RoomGoblin checkout:

```powershell
py tools/prepare-veyon-pilot.py C:\Temp\roomgoblin-veyon-4.11.2
cmake -S C:\Temp\roomgoblin-veyon-4.11.2 -B C:\Temp\roomgoblin-veyon-build `
  -G Ninja -DCMAKE_BUILD_TYPE=Release -DWITH_TRANSLATIONS=OFF -DWITH_LTO=OFF
cmake --build C:\Temp\roomgoblin-veyon-build `
  --target internetguard webbridge remotefilebrowser --parallel 2
```

Those commands prove source compatibility; they do not create a supported
installer. Package and deploy the complete matching pilot using Veyon's official
Windows build/package process, preserving the corresponding source and GPL
notices. Do not mix individual pilot DLLs into a different Veyon or Qt build.

## Acceptance test

Use one disposable Windows lab PC with Veyon 4.11.2 and the exact matching pilot:

1. Confirm `InternetGuard` in `veyon-cli plugin list` and its feature UID in
   `veyon-cli feature list` on the appliance and endpoint package.
2. In RoomGoblin, select only the test PC and open Feature coverage. Confirm
   InternetGuard is Advertised; this is not endpoint verification.
3. Open a normal HTTPS site and an approved local HTTPS service as the baseline.
4. Select **Block Internet — 15 minutes**, confirm the warning, and inspect the
   command result. Verify common web/DNS traffic fails and Veyon stays connected.
5. Inspect Windows Firewall rules whose display-name starts
   `RoomGoblinVeyonIG_`. No unrelated rules may change.
6. Select **Allow Internet now** and verify those rules disappear and both
   baseline destinations work again.
7. Repeat once and wait 15 minutes to verify automatic release. Then test a Veyon
   service restart and run the cleanup command if rules remain.

An Accepted RoomGoblin command is not proof that Windows changed its firewall.
Record the result as working, failed, or uncertain per endpoint.

## Manual recovery

Run from an elevated PowerShell window on the affected test PC:

```powershell
Get-NetFirewallRule -DisplayName 'RoomGoblinVeyonIG_*' -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName 'RoomGoblinVeyonIG_*' -ErrorAction SilentlyContinue
```

The second command should return nothing. Do not flush the firewall, disable
endpoint protection, or remove unrelated policy. Revert the VM snapshot to remove
the complete native pilot.

## Research disposition

The official Veyon Internet Access Control add-on is commercial and requires its
normal license; the public source repository is not permission to bypass that
license. `campusdevfp/internet-veyon-plugin` was excluded because its README says
all rights reserved and its test instructions flush the entire OUTPUT chain.
`lellomele/veyon-internet-guard` was eligible under GPL-2.0, but its published
binary compatibility stops before Veyon 4.11.2, which is why RoomGoblin carries a
reviewed matching-source port rather than the binary.
