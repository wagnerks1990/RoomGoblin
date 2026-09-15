# Room Topology

RoomGoblin keeps three independent inventories:

- **Physical TVs** — power/control endpoints such as Pluto HDBT or HDMI outputs.
- **Content Displays** — RoomGoblin browser/Android display clients that can render text, media, timers, presentations, and announcements.
- **Content Sources** — AV inputs that can be routed to physical TVs.

A physical TV does not need to host a RoomGoblin content display, and a content source does not imply a display client. Stable IDs survive friendly-name changes.

## Compatibility

Existing `tv1`, `tv2`, display groups, `avOutput`, Pluto output labels, source labels, and source endpoint IDs remain supported. RoomGoblin stores the canonical topology and projects it back into the legacy configuration structures consumed by existing renderer, scheduler, AV, credential, and managed-device code.

## Automation targets

- Display actions target **Content Displays**.
- TV power targets **Physical TVs**.
- Lighting actions target lighting devices/groups.
- Class default targets remain content-display defaults.

`All TVs` therefore means all enabled physical-TV endpoints, not all RoomGoblin content displays.

## Operator configuration

Setup exposes the complete topology editor because initial hardware inventory is a setup task.

For normal classroom use, **Displays & AV is matrix-first**. The TV Routing Matrix, routing summary, and quick controls appear before topology administration. The topology editor is kept after the matrix inside a collapsed **Configure TVs, Displays & Sources** section. This preserves the simple routing workflow while keeping the canonical topology available when hardware inventory or mappings actually need to change.

Adding, removing, renaming, or linking a TV/display/source updates the target inventories used by automation, classes, presentations, media, and AV labels without changing unrelated stable identities.

## Future hardware

The canonical model is not limited to an 8×8 matrix. Pluto remains an adapter with its own output/input numbering, while the topology can later contain other adapters and transports without redefining a content display as a TV.
