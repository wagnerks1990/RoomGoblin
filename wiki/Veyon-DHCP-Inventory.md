# Veyon DHCP Inventory

RoomGoblin automatically reconciles Veyon computers whose IPv4 addresses change through DHCP.

The workstation hostname is treated as the stable classroom identity. The IP address is treated as the current connection address. Approximately every 30 seconds while the Veyon workspace is active, RoomGoblin runs the configured subnet discovery and keeps the saved display name and teacher/student role attached to the hostname even if the workstation moved to another address.

The **Discover computers** button performs the same reconciliation immediately.

If a stale offline record and one online record report the same hostname, the workspace hides the stale duplicate. Persistent duplicate records are not deleted automatically because duplicate hostnames can also indicate an endpoint configuration problem.

## What to verify after a DHCP change

- The hostname is still the expected physical workstation.
- The displayed IP changed to the new DHCP lease.
- The custom display name and teacher/student role stayed with the hostname.
- A selection made before the address change follows the hostname rather than the old IP.
- A reversible Veyon action such as lock/unlock reaches the intended physical workstation.

If the computer hostname itself changes, RoomGoblin treats it as a new identity and it should be reviewed manually.
