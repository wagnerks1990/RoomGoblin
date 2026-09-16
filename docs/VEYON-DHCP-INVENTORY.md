# Veyon DHCP Inventory Reconciliation

RoomGoblin treats a Veyon workstation's normalized hostname as the stable classroom identity when IPv4 addresses are assigned by DHCP. The IP address is a mutable transport locator, not the durable device ID shown to operators.

## Why this is required

The historical Veyon store is keyed by IPv4 address. With DHCP, a workstation can move from one address to another, two workstations can exchange leases, or an old address can be reused by a different hostname. An IP-only identity can therefore attach a saved display name, teacher/student role, selection, authentication-key affinity, or command target to the wrong physical computer.

## Server-side identity layer

RoomGoblin now reconciles Veyon identity at the server/API boundary rather than depending on browser cache repair.

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

The Veyon workspace still performs bounded automatic discovery approximately every 30 seconds while visible, plus an initial discovery shortly after loading and a refresh after returning to a stale hidden tab. Manual **Discover computers** remains available.

The browser-side hostname reconciliation helper remains as a compatibility layer for older API responses, but the server is now authoritative for stable identity and current command routing.

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

1. Confirm a workstation appears with its expected hostname, display name, and role.
2. Record its public inventory ID from the API or browser state.
3. Move it to another DHCP address inside the configured scan range.
4. Run discovery or wait for automatic discovery.
5. Confirm the displayed IP changes while the public inventory ID, display name, role, and operator selection remain associated with that hostname.
6. Confirm a reversible lock/unlock or message reaches the workstation at the new address.
7. Reuse the old address with a different hostname and confirm the original hostname is never routed to the new machine.
8. Swap the addresses of two test computers and confirm each hostname keeps its own stable identity and commands follow the physical workstation.
9. If more than one Veyon key is configured, confirm a previously successful key preference follows the workstation to its new address.

If the workstation hostname itself changes, RoomGoblin intentionally treats it as a new identity; rename or reimage workflows should be reconciled deliberately.
