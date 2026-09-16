# Veyon DHCP Inventory

RoomGoblin reconciles Veyon computers whose IPv4 addresses change through DHCP.

The normalized workstation hostname is the stable classroom identity. The IP address is only the current connection address. RoomGoblin now performs this reconciliation on the server/API side so the GUI and command routes receive a stable computer ID even when the endpoint moves to another lease.

Approximately every 30 seconds while the Veyon workspace is active, RoomGoblin runs bounded subnet discovery. **Discover computers** performs the same reconciliation immediately.

When a hostname moves to another IP:

- its public RoomGoblin computer ID stays the same;
- its displayed IP changes to the current lease;
- saved name/role and operator selection remain with the hostname;
- commands are translated to the current backend/IP record immediately before execution;
- the remembered successful Veyon authentication key name follows the workstation to its new address.

If an old IP is reused by a different hostname, the old hostname mapping is invalidated before it can route commands to that address. Historical duplicate rows are suppressed from the public inventory when a current record exists.

## What to verify after a DHCP change

- The hostname is still the expected physical workstation.
- The displayed IP changed to the new DHCP lease.
- The stable RoomGoblin computer ID did not change.
- The custom display name and teacher/student role stayed with the hostname.
- A selection made before the address change follows the hostname rather than the old IP.
- A reversible action such as lock/unlock reaches the intended physical workstation.
- Reusing the old address for another hostname does not make the original computer target that machine.

If the computer hostname itself changes, RoomGoblin treats it as a new identity and it should be reviewed manually.
