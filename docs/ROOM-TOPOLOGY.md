# Room topology

RoomGoblin separates physical AV endpoints from browser/content receivers. This prevents a room with three content receivers and eight physical TVs from treating those inventories as interchangeable.

## Canonical domains

### Physical TVs

A physical TV is an AV/power target. Its stable ID is independent of any content-display receiver ID. A TV may be connected through Pluto HDBT, HDMI, another future matrix, or another supported adapter.

```json
{
  "id": "front-tv",
  "name": "Front TV",
  "enabled": true,
  "transport": {"adapter":"pluto","connection":"hdbt","output":1}
}
```

### Content displays

A content display is a RoomGoblin browser/agent receiver that can render text, timers, URLs, presentations and media. It may optionally point at the physical TV on which that receiver is normally shown.

```json
{
  "id": "tv1",
  "name": "Front Content Display",
  "enabled": true,
  "physicalTvId": "front-tv"
}
```

A physical TV does not need a RoomGoblin content receiver. A content receiver also must not imply that every physical TV exists as a browser receiver.

### Content sources

A content source represents an AV input or other routable source. Its stable ID, friendly name, kiosk/browser endpoint ID and hardware input mapping are separate fields.

```json
{
  "id": "teacher-pc",
  "name": "Teacher PC",
  "endpointId": "teacher",
  "transport": {"adapter":"pluto","input":1}
}
```

### Typed groups

Groups have an explicit domain: `display`, `tv`, `source`, or `lighting`. A TV group never becomes a content-display group merely because IDs happen to look similar.

## Runtime source of truth

The canonical topology is stored in SQLite system preferences. Existing `devices`, `displayGroups`, and Pluto label structures are compatibility projections generated from that topology so legacy renderer, scheduler, credential, managed-device, and AV code can continue operating during migration.

After topology is saved, operator target pickers are refreshed from the canonical inventories:

- display/class/presentation/media targets refresh from enabled content displays;
- TV-power targets refresh from enabled physical TVs;
- AV labels refresh from configured physical-TV outputs and content-source inputs;
- lighting remains an independent inventory.

Removing or disabling an item makes it unavailable to new target selections immediately. Persisted class/automation records can still contain an old stable ID for audit/edit history, but runtime resolution ignores a target that no longer exists in the matching canonical domain until the record is remapped.

## UI contract

- Setup manages TVs, RoomGoblin Displays and AV Sources as separate dynamic inventories.
- **Displays & AV is matrix-first.** The TV Routing Matrix and its routing summary/quick controls are the primary day-to-day interface.
- The topology editor on Displays & AV is secondary administration. It appears after the matrix inside a collapsed **Configure TVs, RoomGoblin Displays & AV Sources** disclosure so routine routing does not require understanding topology internals.
- Pluto output/TV names and Pluto input/AV-source names synchronize into canonical topology when their normal AV controls save them; the open topology editor refreshes from the returned canonical topology automatically.
- RoomGoblin Display names remain directly editable in topology when no other naming surface owns them. Direct topology edits use the visible **Save Changes** action.
- Topology presentation order is stable and independent of friendly names: TVs sort by hardware output number, AV Sources sort by hardware input number, and RoomGoblin Displays sort naturally by stable receiver ID. Renaming an item must not reshuffle the inventory.
- Opening topology configuration must not change the canonical topology model, compatibility projection, stable IDs, target domains, or AV adapter behavior.
- Displays & AV exposes the same topology editor so changes do not need to be repeated elsewhere.
- Automation target controls are domain-specific:
  - display content -> content displays;
  - TV power -> physical TVs;
  - AV routing -> physical TVs and content sources;
  - lighting -> lighting devices/groups.
- Classes retain **Default Display Targets** for content receivers. Class defaults do not silently become physical-TV or lighting targets.
- Renaming changes presentation only. Stable IDs remain unchanged.
- Removing a physical TV unlinks content-display associations to that TV; removing a content display prunes it from typed display groups. Saved target records that reference removed IDs fail closed at runtime instead of being redirected to another device.

## Adapter boundaries

The canonical RoomGoblin inventory is dynamic; individual hardware adapters may still have fixed cardinality.

For the current Pluto Mark I integration, the AV matrix screen is adapter-specific and continues to represent Pluto's physical input/output topology. An eight-port Pluto matrix therefore still shows eight physical matrix inputs/outputs even when fewer content displays are configured. That adapter-specific 8x8 shape must not be reused as the application-wide definition of TVs or content displays.

Future adapters can expose different port counts without redefining a content display as a TV. If a second matrix or transport is added, its endpoints belong in the canonical topology with their own adapter mapping instead of extending Pluto-specific loops blindly.

## Compatibility migration

Existing installations store browser receiver definitions under the legacy `devices` map and Pluto presentation labels separately. Migration derives topology without changing existing stable receiver IDs:

1. Existing configured receivers become content displays.
2. Their `avOutput` values link them to matching physical TVs.
3. Existing Pluto output labels populate physical-TV names.
4. Existing Pluto input labels and source endpoint labels populate content sources.
5. Existing display groups become typed `display` groups.
6. Compatibility projections continue to expose the legacy `devices`, `displayGroups`, and AV-label shapes while older surfaces are migrated.

The legacy projection is a compatibility boundary, not the long-term source of truth.

## Hardware cardinality

The RoomGoblin topology model supports up to 64 items per domain. Application-wide inventory logic must not assume eight TVs, eight sources, or one matrix. The current Pluto Mark I adapter remains bounded by its own hardware topology while the canonical model can contain additional endpoints on other adapters.

## Regression requirements

Tests must cover:

- three content displays with eight physical TVs;
- dynamic physical-TV and content-source inventories independent of display count;
- typed group isolation;
- stable ID preservation across rename;
- safe removal/disable behavior and fail-closed stale references;
- compatibility projection for current Setup, controller and scheduler surfaces;
- matrix-first Displays & AV ordering with topology configuration collapsed by default;
- automatic AV-label-to-topology name synchronization without a second manual save;
- stable hardware/receiver ordering after friendly-name changes;
- Setup, Displays & AV, Automation, Classes, presentations and media consuming the same canonical inventory;
- Morning Announcements priority, scheduler recovery and Background Music arbitration remaining unchanged.
