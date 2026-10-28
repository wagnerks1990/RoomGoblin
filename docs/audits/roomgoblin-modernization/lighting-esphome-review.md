# Lighting and ESPHome review coverage

Group 9 covers the existing lighting and ESPHome capabilities requested in the
modernization brief. Lighting keeps named groups; ESPHome keeps its native
device/entity hierarchy and advertised controls. The shared interaction goals
are current inventory, preserved drafts, visible failures and explicit command
outcomes. No firmware management or new entity domains are introduced.

| Review area | Evidence and preserved boundary |
| --- | --- |
| Discovery and enrollment | Persist lighting enrollment before publication; disabled enrollment stays disabled after restart. ESPHome discovery is bounded, administrator-only and lifecycle-tracked. Enrollment verifies endpoint/MAC identity and stores keys encrypted. |
| Inventory and connection status | Both interfaces reject obsolete read results. ESPHome separates enrollment, enabled state and worker connectivity; lighting inventory keeps telemetry separate from command confirmation. |
| Grouping and identity | Lighting groups retain historical names and references. Validate all command members before sending, capture physical identity and stop remaining sends on replacement. ESPHome generation/MAC checks and command deduplication remain in force. |
| Configuration and drafts | Lighting saves run in accepted order and persist before live projection. ESPHome management has one controller owner; successful saves retain newer form edits and their saved device identity. |
| Entity controls and authorization | Existing command allowlists, confirmations and capabilities remain. Rejected callers cannot consume ESPHome's accepted-caller budgets. Unknown encrypted devices are never silently downgraded. |
| Errors and integration reliability | UDP/MQTT waits are bounded and uncertain writes are not replayed. ESPHome process/pipe errors release pending requests once; discovery waits for complete bounded stdout. |

Detailed findings and qualification are recorded in the linked inventory,
configuration, persistence, dispatch, admission and worker audit notes. PRs
#312–314 are deployed and verified. PR #315 is merged with exact image
publication/delivery pending; the combined ESPHome batch is being qualified.

Physical-device acceptance remains separate: no live discovery, enrollment,
lighting/entity commands, receiver commands or production fault injection was
performed. Representative hardware checks remain documented in
`docs/ESPHOME-INTEGRATION.md`; automated passes do not establish those outcomes.
The broader roadmap, including scheduler later-loop recovery and groups 10–17,
remains active.
