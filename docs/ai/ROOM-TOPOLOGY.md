# Dynamic room topology AI context

Read `docs/ROOM-TOPOLOGY.md` before changing displays, AV routing, setup inventory, class targets, automation targets, presentations, Morning Announcements, Music Assistant TV selection, or any code that enumerates TVs/sources/displays. Use `docs/ai/ROOM-TOPOLOGY-VALIDATION.md` as the regression checklist for those changes.

Do not conflate these domains:

- **TV / physical TV**: AV/power endpoint;
- **RoomGoblin Display / content display**: RoomGoblin browser/agent renderer;
- **AV Source / content source**: routable AV input/source;
- **lighting**: independent lighting inventory.

Stable IDs are compatibility identifiers. Friendly-name changes must not rewrite IDs. RoomGoblin Displays may optionally reference a physical TV, but membership is not one-to-one and neither domain implies the other.

Class `defaultTargets` remain content-display targets. `All TVs` means enabled physical TVs. `All Displays` means enabled RoomGoblin content receivers. Typed groups cannot cross domains.

The canonical topology is SQLite-backed. Legacy `devices`, `displayGroups`, and Pluto AV labels are compatibility projections only. New application-wide behavior must read the canonical topology or the appropriate domain-specific helper instead of inferring physical TVs from content-display rows.

The operator workflow is intentionally **matrix-first**. On Displays & AV, keep the TV Routing Matrix, routing summary, and quick controls ahead of topology administration. The canonical topology editor belongs in the collapsed **Configure TVs, RoomGoblin Displays & AV Sources** disclosure after the matrix. Do not move topology back above routine routing merely because it is the canonical data model; canonical storage and operator task priority are separate concerns.

Name synchronization is also part of the UI contract. Pluto output/TV names and Pluto input/AV-source names are already persisted through the AV label API; saving them must update canonical topology and refresh an open topology editor automatically. Do not require a second topology save for those names. RoomGoblin Display names remain directly editable in topology when no alternate naming surface owns them, with an explicit Save Changes action.

Topology presentation order must remain stable and independent of friendly names. TVs sort by hardware output number, AV Sources sort by hardware input number, and RoomGoblin Displays sort naturally by stable receiver ID. Renaming must not reorder inventory cards.

When a topology item is removed or disabled, runtime resolution must fail closed for stale target IDs. Never silently redirect a missing TV/display/source ID to another endpoint. Preserve the saved record for audit/edit compatibility unless a separately reviewed migration remaps it explicitly.

Adapter cardinality is not application cardinality. The current Pluto Mark I AV surface may remain 8x8 because that is an adapter property, but `tv1..tv8` must never become the global physical-TV inventory. Additional TVs/sources on future adapters must coexist with the Pluto topology.

Any setup or Displays & AV topology save must refresh dependent operator surfaces so Automations, Classes, presentations, media, and AV labels see the same inventory without requiring duplicate configuration.

Preserve existing enrollment credentials, display URLs, ADB trust, Morning Announcements priority, scheduler recovery, Background Music arbitration, and AV routing behavior during migration. Do not commit site-specific names, addresses, credentials, stream endpoints, or infrastructure details when documenting topology examples.
