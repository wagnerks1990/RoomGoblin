# Dynamic room topology AI context

Read `docs/ROOM-TOPOLOGY.md` before changing displays, AV routing, setup inventory, class targets, automation targets, presentations, Morning Announcements, or Music Assistant TV selection.

Do not conflate these domains:

- **TV / physical TV**: AV/power endpoint;
- **RoomGoblin Display / content display**: RoomGoblin browser/agent renderer;
- **AV Source / content source**: routable AV input/source;
- **lighting**: independent lighting inventory.

Stable IDs are compatibility identifiers. Friendly-name changes must not rewrite IDs. RoomGoblin Displays may optionally reference a physical TV, but membership is not one-to-one and neither domain implies the other.

Class `defaultTargets` remain content-display targets. `All TVs` means enabled physical TVs. `All Displays` means enabled RoomGoblin content receivers. Typed groups cannot cross domains.

Current legacy `devices`, `displayGroups`, and Pluto AV labels remain compatibility projections while UI/runtime surfaces migrate to the canonical topology. Preserve existing enrollment credentials, display URLs, ADB trust, Morning Announcements priority, scheduler recovery, Background Music arbitration, and AV routing behavior during migration.

The operator workflow is intentionally **matrix-first**. On Displays & AV, keep the TV Routing Matrix, routing summary, and quick controls ahead of topology administration. The canonical topology editor belongs in the collapsed **Configure TVs, RoomGoblin Displays & AV Sources** disclosure after the matrix. Do not move topology back above routine routing merely because it is the canonical data model; canonical storage and operator task priority are separate concerns.

Name synchronization is also part of the UI contract. Pluto output/TV names and Pluto input/AV-source names are already persisted through the AV label API; saving them must update canonical topology and refresh an open topology editor automatically. Do not require a second topology save for those names. RoomGoblin Display names remain directly editable in topology when no alternate naming surface owns them, with an explicit Save Changes action.

Topology presentation order must remain stable and independent of friendly names. TVs sort by hardware output number, AV Sources sort by hardware input number, and RoomGoblin Displays sort naturally by stable receiver ID. Renaming must not reorder inventory cards.

Never hard-code `tv1..tv8` as the application-wide physical-TV inventory. Pluto Mark I may expose eight outputs today, but the topology model must support future additional TVs, sources, and adapters.
