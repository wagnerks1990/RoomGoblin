# Room Topology

RoomGoblin keeps three independent inventories:

- **TVs** — physical AV/power endpoints such as Pluto HDBT or HDMI outputs.
- **RoomGoblin Displays** — RoomGoblin browser/Android display clients that render text, media, timers, presentations, and announcements.
- **AV Sources** — AV inputs that can be routed to TVs.

A TV does not need to host a RoomGoblin Display, and an AV Source does not imply a display client. Stable IDs survive friendly-name changes.

## Compatibility

Existing `tv1`, `tv2`, display groups, `avOutput`, Pluto output labels, source labels, and source endpoint IDs remain supported. RoomGoblin stores the canonical topology and projects it back into the legacy configuration structures consumed by existing renderer, scheduler, AV, credential, and managed-device code.

## Automation targets

- Display actions target **RoomGoblin Displays**.
- TV power targets **TVs**.
- Lighting actions target lighting devices/groups.
- Class default targets remain RoomGoblin-display defaults.

`All TVs` therefore means all enabled physical-TV endpoints, not all RoomGoblin content receivers.

## Operator configuration

Setup exposes the complete topology editor because initial hardware inventory is a setup task.

For normal classroom use, **Displays & AV is matrix-first**. The TV Routing Matrix, routing summary, and quick controls appear before topology administration. The topology editor is kept after the matrix inside a collapsed **Configure TVs, RoomGoblin Displays & AV Sources** section.

Names synchronize wherever RoomGoblin already has an owning control surface. Saving a Pluto TV/output name or AV source/input name updates canonical topology and refreshes the open topology editor automatically. RoomGoblin Display names remain editable directly in topology when there is no alternate naming surface, using **Save Changes**.

Inventory order is intentionally stable rather than alphabetical: TVs follow hardware output order, AV Sources follow hardware input order, and RoomGoblin Displays follow natural stable receiver-ID order. Friendly-name changes must never reshuffle those lists.

Adding, removing, renaming, or linking a TV/display/source updates the target inventories used by automation, classes, presentations, media, and AV labels without changing unrelated stable identities.

## Future hardware

The canonical model is not limited to an 8×8 matrix. Pluto remains an adapter with its own output/input numbering, while the topology can later contain other adapters and transports without redefining a RoomGoblin Display as a TV.
