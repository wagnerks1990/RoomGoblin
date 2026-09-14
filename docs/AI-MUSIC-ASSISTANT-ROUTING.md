# AI Context — Music Assistant Player Routing

This file is a focused AI/contributor context for RoomGoblin's Music Assistant player identity rules.

## Invariant

One physical device may appear in Music Assistant as a Universal Player plus one or more protocol-specific player records. Do not treat every `players/all` item as a separate physical speaker.

Use Music Assistant's explicit `output_protocols[].output_protocol_id` relationship to correlate protocol children with their canonical parent. Do not deduplicate by display name, MAC-looking IDs, or a guessed `up<mac>` naming convention.

## Controller behavior

- Keep linked protocol children available for diagnostics.
- Show the canonical parent once in normal player controls.
- Route `player_id` and `queue_id` commands to the canonical parent when a child alias is known.
- Background Music queue ownership belongs to the canonical player, not necessarily the active output protocol child.
- Preserve upstream queue-empty errors as queue-state errors; do not classify them as network failures.

## ESPHome boundary

ESPHome entities named `Sendspin Player` and `Player` can both legitimately exist inside one CAST-1. They are native ESPHome entities and are not evidence of duplicate ESPHome device discovery. Do not merge ESPHome entities using Music Assistant player rules.

## Regression

Keep `test/music-assistant-universal-player.test.js` passing together with the full repository suite. See `docs/MUSIC-ASSISTANT-PLAYER-ROUTING.md` for the detailed operator/developer contract.
