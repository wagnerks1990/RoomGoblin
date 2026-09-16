# Veyon DHCP Inventory

RoomGoblin reconciles Veyon computers whose IPv4 addresses change through DHCP.

The normalized workstation hostname is the stable classroom identity. The IP address is only the current connection address. RoomGoblin performs this reconciliation on the server/API side so the GUI and command routes receive a stable computer ID even when the endpoint moves to another lease.

Approximately every 30 seconds while the Veyon workspace is active, RoomGoblin runs bounded subnet discovery. **Discover computers** performs the same reconciliation immediately.

## Discovery must have a scan subnet

Automatic discovery and DHCP tracking require **Settings → Integrations & Hardware → Veyon Classroom Computers → Scan subnet prefix** to be configured. The scan start/end fields bound the host range.

A blank scan subnet can be deceptive: the Veyon WebAPI can be healthy, clients can be reachable, and old computers can still appear from the persisted inventory while discovery has no targets. In that state RoomGoblin cannot learn new DHCP leases. Configure the subnet, run **Discover computers**, and confirm the result reports the expected live computers.

The browser no longer performs its own DHCP identity repair writes. It triggers the server-side discovery, reloads the authoritative inventory, and restores selection by hostname.

When a hostname moves to another IP:

- its public RoomGoblin computer ID stays the same;
- its displayed IP changes to the current lease;
- saved name/role and operator selection remain with the hostname;
- commands are translated to the current backend/IP record immediately before execution;
- the remembered successful Veyon authentication key name follows the workstation to its new address.

If an old IP is reused by a different hostname, the old hostname mapping is invalidated before it can route commands to that address. Historical duplicate rows are suppressed from the public inventory when a current record exists.

## What to verify after a DHCP change

- Scan subnet prefix is configured and discovery finds the expected online clients.
- The hostname is still the expected physical workstation.
- The displayed IP changed to the new DHCP lease.
- The stable RoomGoblin computer ID did not change.
- The custom display name and teacher/student role stayed with the hostname.
- A selection made before the address change follows the hostname rather than the old IP.
- A reversible action such as lock/unlock reaches the intended physical workstation.
- Reusing the old address for another hostname does not make the original computer target that machine.

If Veyon temporarily reports an IP address as the hostname, RoomGoblin does not treat that IP as durable identity. Reverse DNS is not assumed to exist. A later hostname-bearing discovery can reconcile the record.

If the computer hostname itself changes, RoomGoblin treats it as a new identity and it should be reviewed manually.
