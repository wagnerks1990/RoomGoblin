# Dynamic room topology AI context

Read `docs/ROOM-TOPOLOGY.md` before changing displays, AV routing, setup inventory, class targets, automation targets, presentations, Morning Announcements, or Music Assistant TV selection.

Do not conflate these domains:

- **physical TV**: AV/power endpoint;
- **content display**: RoomGoblin browser/agent renderer;
- **content source**: routable AV input/source;
- **lighting**: independent lighting inventory.

Stable IDs are compatibility identifiers. Friendly-name changes must not rewrite IDs. Content displays may optionally reference a physical TV, but membership is not one-to-one and neither domain implies the other.

Class `defaultTargets` remain content-display targets. `All TVs` means enabled physical TVs. `All Displays` means enabled RoomGoblin content receivers. Typed groups cannot cross domains.

Current legacy `devices`, `displayGroups`, and Pluto AV labels remain compatibility projections while UI/runtime surfaces migrate to the canonical topology. Preserve existing enrollment credentials, display URLs, ADB trust, Morning Announcements priority, scheduler recovery, Background Music arbitration, and AV routing behavior during migration.

Never hard-code `tv1..tv8` as the application-wide physical-TV inventory. Pluto Mark I may expose eight outputs today, but the topology model must support future additional TVs, sources, and adapters.
