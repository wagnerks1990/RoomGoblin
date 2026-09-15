# Room Topology Validation

Use this checklist after topology, targeting, or AV-inventory changes:

- Physical TVs, content displays, content sources, and lighting remain separate domains.
- `All TVs` uses physical-TV inventory; `All Displays` uses content-display inventory.
- Class defaults stay content-display scoped.
- TV power never derives its target set from browser/content-display inventory.
- Stable IDs survive friendly-name changes.
- Typed groups do not cross domains.
- Removed/disabled target IDs fail closed until explicitly remapped.
- Setup and Displays & AV show the same canonical topology.
- Automations, Classes, presentations, media, and AV labels refresh after a topology save.
- Pluto's fixed 8×8 behavior remains adapter-specific.
- Morning Announcements, scheduler recovery, Background Music, display credentials, enrollment IDs, ADB trust, and managed-device compatibility remain intact unless deliberately changed and tested.

See [Room Topology](Room-Topology) for the architecture contract.
