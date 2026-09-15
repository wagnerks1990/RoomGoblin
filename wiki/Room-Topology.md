# Room Topology

RoomGoblin keeps three independent inventories:

- **TVs** — physical AV/power endpoints such as Pluto HDBT or HDMI outputs.
- **RoomGoblin Displays** — RoomGoblin browser/Android display clients that render text, media, timers, presentations, and announcements.
- **AV Sources** — AV inputs that can be routed to TVs.

A TV does not need to host a RoomGoblin Display, and an AV Source does not imply a display client. Stable IDs survive friendly-name changes.

## Canonical source of truth

Room topology is stored in SQLite. Legacy display/device maps, display groups, and Pluto labels are compatibility projections generated from the canonical topology so existing renderer, scheduler, AV, credential, and managed-display paths keep working while the application converges on the new model.

Saving topology refreshes the target inventories used by Automations, Classes, presentations, media, and AV labels. A removed or disabled endpoint disappears from new target selections immediately. Saved records that still reference a missing ID remain editable but resolve to no target until remapped; RoomGoblin does not silently redirect them to another endpoint.

## Compatibility

Existing `tv1`, `tv2`, display groups, `avOutput`, Pluto output labels, source labels, source endpoint IDs, display URLs, credentials, and managed-device identity remain supported.

## Automation and class targets

- Display actions target **RoomGoblin Displays**.
- TV power targets **TVs**.
- AV routing uses **TVs** plus **AV Sources**.
- Lighting actions target lighting devices/groups.
- Class default targets remain RoomGoblin-display defaults.

`All TVs` therefore means all enabled physical-TV endpoints, not all RoomGoblin content receivers. `All Displays` means all enabled content receivers.

## Operator configuration

Setup exposes the complete topology editor because initial hardware inventory is a setup task.

For normal classroom use, **Displays & AV is matrix-first**. The TV Routing Matrix, routing summary, and quick controls appear before topology administration. The topology editor is kept after the matrix inside a collapsed **Configure TVs, RoomGoblin Displays & AV Sources** section.

Names synchronize wherever RoomGoblin already has an owning control surface. Saving a Pluto TV/output name or AV source/input name updates canonical topology and refreshes the open topology editor automatically. RoomGoblin Display names remain editable directly in topology when there is no alternate naming surface, using **Save Changes**.

Inventory order is intentionally stable rather than alphabetical: TVs follow hardware output order, AV Sources follow hardware input order, and RoomGoblin Displays follow natural stable receiver-ID order. Friendly-name changes must never reshuffle those lists.

Setup and **Displays & AV** expose the same topology editor. Adding, removing, renaming, disabling, or linking a TV/display/source updates the rest of the application's target inventory without changing unrelated stable identities.

Removing a physical TV unlinks any content-display association to it. Removing a content display prunes it from typed display groups. Stale saved target IDs fail closed at runtime.

## Adapter boundaries

RoomGoblin's inventory is dynamic, but a hardware adapter can still have a fixed physical shape. The current Pluto Mark I screen represents that adapter's matrix and may remain 8×8 even when RoomGoblin has fewer content displays. That Pluto-specific shape is not the application-wide TV inventory.

Future matrices/transports can add endpoints to the canonical topology with their own adapter mappings instead of redefining content displays as TVs or extending Pluto-specific assumptions.

## Related documentation

- `docs/ROOM-TOPOLOGY.md` — canonical architecture and migration contract.
- `docs/ai/ROOM-TOPOLOGY.md` — AI/contributor invariants for topology-related changes.
- `wiki/Configuration.md` — broader appliance configuration model.
- `wiki/Automation-Display-Media.md` — automation/display targeting behavior.
