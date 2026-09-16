# AI Context: Veyon DHCP Inventory Identity

This file is an AI/contributor contract for Veyon workstation identity when addresses are assigned by DHCP.

## Identity rule

Treat hostname as the stable classroom identity and IPv4 address as a mutable transport locator. Do not persist operator meaning such as display name or teacher/student role solely by IP address.

The historical backend inventory is still keyed by IP for compatibility. Until that storage model is migrated with database and command-queue tests, the Veyon workspace reconciles metadata across address changes by normalized hostname.

## Required behavior

- Snapshot known display name and role by normalized hostname before a subnet discovery mutates IP-keyed records.
- After discovery, reapply those fields to the record currently reporting that hostname.
- Preserve an operator selection by hostname across an address change so a command cannot silently follow the old IP to a different workstation.
- Run discovery periodically while the Veyon workspace is active, but keep it bounded and single-flight.
- Keep manual discovery available and surface manual failures; background failures must not spam the operator.
- Hide a stale offline duplicate only when exactly one same-hostname record is online. Do not automatically delete persistent duplicate-hostname records.
- Do not infer identity from signed-in username, current IP, Veyon connection UID, or framebuffer state.
- Do not commit site-specific subnets or hostnames.

## Security and compatibility

All writes must continue through existing capability-protected Veyon APIs. Never expose or cache the private Veyon key, connection UID, command arguments, or credentials in browser storage. The browser identity cache may contain only presentation metadata keyed by hostname.

Do not rename compatibility-sensitive Veyon routes or replace native `veyon.service` / `veyon-webapi.service` ownership. Morning Announcements, Background Music, display scheduling, managed-display behavior and other RoomGoblin invariants are unrelated and must remain unchanged.

## Future backend migration

A future storage migration may introduce a durable hostname- or endpoint-identity key in the database. Such a migration must preserve existing roles, names, command ownership/recovery behavior, and old inventory compatibility; handle duplicate hostnames explicitly; and include rollback/data-preservation coverage before removing the browser reconciliation layer.
