# Veyon DHCP Inventory Reconciliation

RoomGoblin treats a Veyon workstation's normalized hostname as the stable classroom identity when IPv4 addresses are assigned by DHCP. The IP address is a mutable transport locator, not the durable device ID shown to operators.

## Why this is required

The historical Veyon store is keyed by IPv4 address. With DHCP, a workstation can move from one address to another, two workstations can exchange leases, or an old address can be reused by a different hostname. An IP-only identity can therefore attach a saved display name, teacher/student role, selection, authentication-key affinity, or command target to the wrong physical computer.

## Server-side identity layer

RoomGoblin reconciles Veyon identity at the server/API boundary rather than depending on browser cache repair.

For authenticated computers with a usable hostname:

- the public inventory ID is a stable hostname-derived ID;
- discovery records the current backend/IP inventory ID for that hostname;
- a DHCP address move updates the hostname mapping atomically while the public ID stays unchanged;
- the previous address is retained only as bounded reconciliation metadata;
- if an address is reused by a different hostname, the old hostname mapping is marked stale before the address can be targeted through it;
- duplicate historical rows are suppressed from the public inventory when a current row for the same hostname exists;
- requests using a stable public ID are translated back to the current backend/IP ID immediately before the established protected Veyon handler runs;
- the remembered successful Veyon authentication-key name moves with the hostname to its new address.

The existing IP-keyed Veyon object store remains a compatibility implementation detail. Operators and browser workspaces no longer need to treat that IP key as device identity.

## Discovery behavior

The Veyon workspace performs bounded automatic discovery approximately every 30 seconds while visible, plus an initial discovery shortly after loading and a refresh after returning to a stale hidden tab. Manual **Discover computers** remains available.

Automatic DHCP tracking requires a configured scan subnet prefix. `VEYON_SCAN_SUBNET` / the GUI **Scan subnet prefix** must identify the subnet that contains the managed Veyon clients. If this value is blank, discovery has no targets and DHCP address changes cannot be learned automatically. Existing database inventory may still appear, which can otherwise make the configuration error look like a DHCP-reconciliation failure.

The browser now treats the server as the identity authority. It triggers discovery, refreshes the inventory, and restores selection by hostname, but it no longer writes client-side role/name patches in an attempt to repair DHCP identity.

## Operational diagnosis

When discovery appears stale:

1. Read **Settings → Integrations & Hardware → Veyon Classroom Computers** and confirm **Scan subnet prefix**, start, and end are configured.
2. Call `POST /api/v1/veyon/discover` and verify `summary.found` is non-zero when managed clients are online.
3. Confirm discovered rows have a hostname-derived public ID such as `host-<normalized-hostname>` rather than an IP address.
4. Compare `GET /api/v1/veyon/computers?info=0` after discovery and confirm the hostname remains stable while the IP reflects the current DHCP lease.
5. If Veyon temporarily reports an IP string as `hostname`, do not treat that IP as a stable identity. A later successful hostname-bearing discovery may reconcile it; standard reverse DNS is not assumed to exist.

A successful host TCP check alone does not prove discovery is configured. The RoomGoblin host can reach Veyon clients while `scanSubnet` is blank, in which case manual and automatic discovery still have no scan target range.

## Safety boundaries

- Discovery continues to use configured `VEYON_SCAN_SUBNET`, `VEYON_SCAN_START`, and `VEYON_SCAN_END` values. No deployment-specific subnet is committed.
- Existing capability checks remain authoritative for inventory, sensitive previews, and commands.
- Hostname is used only when it is non-empty and is not merely an IPv4 string.
- A hostname change is treated as a different computer identity.
- A stale hostname whose former IP has been claimed by another hostname does not resolve to that address.
- Veyon private-key material is never stored in the hostname mapping.
- Only the successful key name is migrated when a workstation changes address.
- Native `veyon.service` and `veyon-webapi.service` remain host-managed.

## Acceptance checks

Use non-critical workstations first:

1. Confirm **Scan subnet prefix** is configured and discovery finds the expected live clients.
2. Confirm a workstation appears with its expected hostname, display name, and role.
3. Record its public inventory ID from the API or browser state.
4. Move it to another DHCP address inside the configured scan range.
5. Run discovery or wait for automatic discovery.
6. Confirm the displayed IP changes while the public inventory ID, display name, role, and operator selection remain associated with that hostname.
7. Confirm a reversible lock/unlock or message reaches the workstation at the new address.
8. Reuse the old address with a different hostname and confirm the original hostname is never routed to the new machine.
9. Swap the addresses of two test computers and confirm each hostname keeps its own stable identity and commands follow the physical workstation.
10. If more than one Veyon key is configured, confirm a previously successful key preference follows the workstation to its new address.

If the workstation hostname itself changes, RoomGoblin intentionally treats it as a new identity; rename or reimage workflows should be reconciled deliberately.
