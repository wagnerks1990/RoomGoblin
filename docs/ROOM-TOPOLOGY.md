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

## UI contract

- Setup manages TVs, RoomGoblin Displays and AV Sources as separate dynamic inventories.
- **Displays & AV is matrix-first.** The TV Routing Matrix and its routing summary/quick controls are the primary day-to-day interface.
- The topology editor on Displays & AV is secondary administration. It appears after the matrix inside a collapsed **Configure TVs, RoomGoblin Displays & AV Sources** disclosure so routine routing does not require understanding topology internals.
- Pluto output/TV names and Pluto input/AV-source names synchronize into canonical topology when their normal AV controls save them; the open topology editor refreshes from the returned canonical topology automatically.
- RoomGoblin Display names remain directly editable in topology when no other naming surface owns them. Direct topology edits use the visible **Save Changes** action.
- Topology presentation order is stable and independent of friendly names: TVs sort by hardware output number, AV Sources sort by hardware input number, and RoomGoblin Displays sort naturally by stable receiver ID. Renaming an item must not reshuffle the inventory.
- Opening topology configuration must not change the canonical topology model, compatibility projection, stable IDs, target domains, or AV adapter behavior.
- Automation target controls are domain-specific:
  - display content -> content displays;
  - TV power -> physical TVs;
  - AV routing -> physical TVs and content sources;
  - lighting -> lighting devices/groups.
- Classes retain **Default Display Targets** for content receivers. Class defaults do not silently become physical-TV or lighting targets.
- Renaming changes presentation only. Stable IDs remain unchanged.
- Removing an item must detect references in groups, classes, automations and AV mappings and either migrate them explicitly or require confirmation.

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

The RoomGoblin topology model supports up to 64 items per domain. A Pluto Mark I adapter may still expose an 8x8 hardware topology, but application-wide inventory logic must not assume eight TVs, eight sources, or one matrix. Future adapters can expose different cardinalities while using the same canonical inventory.

## Regression requirements

Tests must cover:

- three content displays with eight physical TVs;
- dynamic counts greater than eight;
- typed group isolation;
- stable ID preservation across rename;
- safe pruning/reference checks during removal;
- compatibility projection for current Setup, controller and scheduler surfaces;
- matrix-first Displays & AV ordering with topology configuration collapsed by default;
- automatic AV-label-to-topology name synchronization without a second manual save;
- stable hardware/receiver ordering after friendly-name changes;
- Morning Announcements priority, scheduler recovery and Background Music arbitration remaining unchanged.
