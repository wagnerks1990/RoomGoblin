# Music Assistant Player Routing

## Purpose

RoomGoblin integrates with Music Assistant for Background Music, direct player controls, and the RoomGoblin TV Sendspin bridge. Music Assistant 2.9+ can expose more than one player record for one physical device when a Universal Player wraps one or more protocol-specific players.

A real CAST-1 live test demonstrated the expected shape:

```text
Universal Player: up44b176da3eff
Protocol child:   44:B1:76:DA:3E:FF
Display name:     Apollo CAST-1 da3efc
Protocol:         Sendspin
```

These are not two physical devices. The Universal Player owns the user-facing queue and selects an active output protocol. The protocol child remains useful for transport diagnostics.

## Canonicalization contract

RoomGoblin requests protocol players so transport state remains observable, but the controller must not render a protocol child as a second independent speaker when a returned parent player explicitly lists that child in `output_protocols[].output_protocol_id`.

Canonicalization rules:

1. Build the relationship only from Music Assistant's returned `output_protocols` metadata.
2. Prefer a Universal Player parent when more than one returned player references the same protocol child.
3. Keep protocol children available in the status response as `protocolPlayers` for diagnostics.
4. Return only canonical/user-facing players in `players`.
5. Return the child-to-parent relationship in `playerAliases`.
6. Rewrite controller-originated `player_id` and `queue_id` values through the alias map before calling Music Assistant.
7. Never deduplicate solely by display name, MAC-looking string, or a hard-coded `up<mac>` convention.

This preserves compatibility if Music Assistant changes Universal Player identifier formatting while retaining its public output-protocol relationship.

## Queue ownership

Background Music and `player_queues/play_media` must target the canonical Universal Player queue when one exists. Sending queue commands to a Sendspin protocol child can fail with errors such as:

```text
PlayerUnavailableError: Queue <protocol-player-id> is not available
```

The protocol child can still be the actual active output selected by the Universal Player. Queue ownership and output transport identity are different concepts.

## Play/Pause and empty queues

A `players/cmd/play_pause` request against an idle player with no queued media can legitimately be rejected by Music Assistant with a queue-empty error. That is not a RoomGoblin network/transport failure. Load media into the canonical queue first (for example through a Background Music favorite or search result), then pause/resume controls operate on that queue.

RoomGoblin should preserve the upstream error rather than misdiagnosing it as a disconnected player.

## ESPHome CAST-1 media entities

The CAST-1 ESPHome native API separately exports multiple media-player entities, including `Sendspin Player` and `Player`. Those are legitimate entities inside one ESPHome device and are distinct from the Music Assistant Universal Player/protocol-child records described above.

Do not remove or merge ESPHome entities merely because their names or purpose overlap with Music Assistant players. ESPHome entity presentation and Music Assistant player canonicalization are separate layers.

## Regression coverage

`test/music-assistant-universal-player.test.js` verifies that:

- a protocol child referenced by a Universal Player is hidden from the normal controller player list;
- the protocol child remains available for diagnostics;
- child player and queue IDs resolve to the Universal Player;
- unrelated/native players remain unchanged;
- unknown protocol references do not hide unrelated players.

Production validation must continue to run `npm run check` and the complete `npm test` suite.
