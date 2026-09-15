# Room topology validation checklist

Use this checklist when a change can affect topology, targets, or AV inventory.

- Physical TVs, content displays, content sources, and lighting remain separate domains.
- `All TVs` resolves from physical-TV inventory; `All Displays` resolves from content-display inventory.
- Classes keep content-display defaults.
- TV power does not derive targets from content-display rows.
- Stable IDs survive friendly-name changes.
- Topology cards keep output/input order for TVs/AV Sources and natural stable receiver-ID order for RoomGoblin Displays after rename.
- Displays & AV keeps routing first, configuration collapsed, and AV-label saves synchronized with topology without a second save.
- Typed groups do not cross domains.
- Removed/disabled IDs fail closed until explicitly remapped.
- Setup and Displays & AV expose the same canonical topology.
- Automation, Classes, presentations, media, and AV labels refresh after topology save.
- Pluto-specific 8×8 behavior stays inside the Pluto adapter boundary.
- Morning Announcements priority, scheduler recovery, Background Music arbitration, display credentials, enrollment IDs, ADB trust, and managed-device compatibility remain unchanged unless explicitly reviewed.
- Generic documentation contains no site-specific addresses, credentials, streams, or infrastructure details.
