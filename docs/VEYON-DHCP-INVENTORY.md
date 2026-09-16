# Veyon DHCP Inventory Reconciliation

RoomGoblin must treat a Veyon workstation's hostname as its stable classroom identity when IPv4 addresses are assigned by DHCP. The IP address is a current transport address, not a durable device identifier.

## Problem addressed

The historical Veyon inventory key is derived from the IPv4 address. When DHCP moves a workstation to another address, or two classroom computers exchange leases, an IP-keyed inventory can temporarily attach the wrong display name or teacher/student role to the current machine at that address. It can also leave an offline duplicate at the machine's former address.

This is especially dangerous for classroom controls because commands target the current Veyon endpoint at the saved address. The operator UI must therefore reconcile the address against the hostname before preserving classroom metadata.

## Current reconciliation behavior

The Veyon workspace now runs a bounded discovery approximately every 30 seconds while the page is active, plus an initial discovery shortly after loading and a refresh when a hidden tab becomes active again.

Before discovery, the browser reads the existing inventory and snapshots metadata by normalized hostname:

- display name;
- `teacher` / `student` role;
- previous inventory ID.

It then asks the backend to run the normal configured subnet discovery. For every authenticated discovered computer, RoomGoblin compares the current hostname to the pre-discovery identity snapshot. If that hostname is now at a different IP address, the workspace reapplies the saved display name and role to the current address through the existing protected Veyon computer API.

A small browser cache keyed only by hostname is retained as a fallback so a previously reconciled identity can survive a browser reload. The pre-discovery server inventory remains preferred when available so legitimate operator changes are not overwritten by stale browser data.

Offline duplicates with the same hostname are hidden in the workspace only when exactly one record for that hostname is online. Duplicate records are not automatically deleted from persistent storage because two machines with the same hostname represent an endpoint-configuration problem that should not be destroyed automatically.

## Safety boundaries

- Discovery continues to use the configured `VEYON_SCAN_SUBNET`, `VEYON_SCAN_START`, and `VEYON_SCAN_END` values. No school-specific subnet is committed.
- Background discovery is silent if the current operator lacks permission or discovery fails. Manual **Discover computers** still surfaces the error.
- Existing backend capability checks remain authoritative. The browser does not receive Veyon keys or connection UIDs.
- Commands continue to target the current backend inventory ID/IP after reconciliation.
- Selection follows the hostname across a DHCP address change so the operator does not accidentally act on the machine that inherited an old IP.
- The feature does not rotate Veyon authentication keys, alter endpoint configuration, or recreate native Veyon services.

## Acceptance checks

Use two non-critical test workstations before classroom-wide validation:

1. Confirm both machines appear with their expected hostname, display name, and role.
2. Change their DHCP leases or otherwise move each machine to a different address within the configured scan range.
3. Wait up to 30 seconds with the Veyon workspace visible, or click **Discover computers**.
4. Confirm each hostname now shows its new IP while retaining its original display name and teacher/student role.
5. Confirm an old offline duplicate is not shown when the same hostname has exactly one online record.
6. Select one machine before a lease change and confirm the selection follows that hostname, not the old IP.
7. Test a reversible command such as screen lock/unlock on one machine and verify the command reaches the expected physical workstation.

If the hostname itself changes, RoomGoblin treats that as a new identity. Rename/reimage workflows must therefore update the workstation inventory deliberately rather than relying on DHCP reconciliation.
