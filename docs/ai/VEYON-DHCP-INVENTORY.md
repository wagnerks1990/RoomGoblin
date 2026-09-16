# AI Context: Veyon DHCP Inventory Identity

This file is the contributor contract for Veyon workstation identity when addresses are assigned by DHCP.

## Identity rule

Treat normalized hostname as the stable classroom identity and IPv4 address as a mutable transport locator. Do not attach durable operator meaning or command identity solely to an IP address.

The historical Veyon object store remains IP-keyed internally for compatibility, but the server/API boundary publishes stable hostname-derived IDs and resolves those IDs to the current backend/IP record immediately before protected Veyon handlers execute.

## Required behavior

- Reconcile discovery results by normalized hostname on the server.
- Keep the public/stable computer ID unchanged when DHCP changes the current IP.
- Persist only bounded hostname-to-current-backend mapping metadata.
- If an IP/backend ID is claimed by a different hostname, invalidate the old hostname mapping before it can route a command.
- Suppress stale historical rows when a current row exists for the same hostname.
- Preserve display name, teacher/student role, browser selection, and command intent across address changes.
- Move the remembered successful Veyon key-name affinity from the old IP to the new IP; never copy private-key material into identity metadata.
- Support two-machine address swaps without losing either identity.
- Continue bounded single-flight automatic discovery while the Veyon workspace is active.
- Require a configured scan subnet for automatic discovery/DHCP tracking; do not describe the scan subnet as optional when fresh DHCP tracking is expected.
- Keep manual discovery and capability checks intact.
- Do not infer identity from signed-in username, Veyon connection UID, framebuffer state, reverse DNS, or an IP string used as a fallback hostname.
- Do not commit deployment-specific subnets or hostnames.

## Browser contract

The browser is not the source of truth for DHCP identity. It may trigger discovery, refresh the server-issued inventory, preserve operator selection by hostname, and suppress obvious stale duplicates for compatibility. It must not issue client-side inventory PUTs to repair hostname/IP identity after discovery.

Before starting discovery, the browser should surface a clear configuration error when the server reports an empty scan subnet instead of silently presenting `found: 0` as if a real scan succeeded.

## Operational lesson

A blank scan subnet can coexist with a healthy native Veyon WebAPI, reachable Veyon clients, and a populated persisted inventory. That combination is misleading: existing machines can still render from the database while automatic discovery has no targets, so DHCP changes cannot be learned. Diagnose discovery configuration separately from TCP reachability and persisted inventory state.

If Veyon temporarily returns an IPv4 string in the hostname field, do not promote that IP to durable identity. RoomGoblin does not assume reverse DNS exists. Later hostname-bearing discovery may reconcile the record.

Do not rename compatibility-sensitive Veyon routes or replace native `veyon.service` / `veyon-webapi.service` ownership. Morning Announcements, Background Music, display scheduling, managed displays, recovery, and other RoomGoblin invariants must remain unchanged.

## Tests that must stay covered

- one hostname moving from address A to B;
- old address reused by another hostname;
- two computers swapping addresses;
- stale duplicate suppression;
- stable-ID-to-current-backend translation;
- Veyon key-name affinity migration;
- ordinary records without a usable hostname remaining compatible;
- browser discovery remaining read/refresh oriented and not applying identity-repair PUTs;
- empty scan-subnet state producing a clear operator-facing discovery warning.
