# Govee lighting ownership

RoomGoblin keeps Govee device aliases, physical IDs, groups and discovery
overrides in its existing hardware/registry configuration. Friendly names do not
replace physical IDs. MQTT supplies discovery, availability and state; native
H618G color-temperature writes retain their existing UDP packet and port.

## Operator configuration

Device metadata and automatic-enrollment preference saves validate a proposed
registry and persist it before changing live projections. A failed write or
invalid name preserves current names, group membership and enrollment policy.
An explicit later retry remains available. Preserve existing registry keys,
device identity, configured data and the existing name/alias normalization.
Names that coincide with object prototype properties are data, including when
saved groups are rebuilt on startup; inherited device properties are not known
device aliases.

Within one controller, metadata, discovery preference and cleanup writes run in
accepted order. Inventory reads wait for accepted configuration writes and
discard responses predating a later write. Operator drafts and the latest action
result survive intermediate replies. Successful saves with failed refreshes say
both outcomes. See [GUI workspaces](GUI-WORKSPACES.md#compact-govee-lighting).

These controller rules do not serialize different browser sessions. The shared
browser API still supplies its existing fetch lifetime.

## Discovery and cleanup

When automatic enrollment is disabled, unknown physical devices do not enter
the registry, including on a later preference save or restart. Known devices
retain their aliases and continue receiving transient state/presence updates.
Rediscovery preserves operator names, existing physical metadata, groups and
historical registry keys.

Enrollment and cleanup stage the complete registry change and persist it before
updating inventory, group references or notifications. Manual cleanup combines
synthetic migration and stale-device removal in one write. A failed write keeps
the prior live registry and projections; later explicit or periodic attempts
remain possible. Periodic grace, configured-device retention and unknown-time
behavior remain unchanged.

Startup migration runs after audit initialization. Startup, MQTT discovery and
periodic cleanup failures are diagnostic and do not terminate the Hub or mark
the MQTT connection unavailable. Freeze/shutdown still reject background writes.
These operations update configuration only; they do not dispatch hardware commands.

## Command completion

Shared MQTT publication and native UDP temperature writes have five-second
completion deadlines. MQTT admission checks the captured client and runtime
state, disables offline QoS-zero queuing and settles old connection owners on
disconnect or replacement. UDP contains socket errors and closes once on every
outcome. Neither path retries uncertain writes. Already buffered network bytes
cannot be recalled, so timeout/disconnect does not prove hardware rejection.

MQTT also serves the existing JSON/legacy display bridges. Preserve their
payloads, receiver persistence and announcement priority; lighting failures do
not change unrelated integration health. Accepted HTTP writes remain in the
application drain after browser disconnect. See [application lifecycle](APPLICATION-LIFECYCLE.md).
