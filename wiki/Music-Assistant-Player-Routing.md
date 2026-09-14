# Music Assistant Player Routing

Music Assistant may expose one physical speaker through a Universal Player plus one or more protocol-specific children. RoomGoblin keeps protocol children for diagnostics but uses the Universal Player as the user-facing playback/queue target.

A CAST-1 live test showed:

```text
Universal Player: up44b176da3eff
Sendspin child:   44:B1:76:DA:3E:FF
Name:             Apollo CAST-1 da3efc
```

RoomGoblin must correlate these records from Music Assistant's `output_protocols[].output_protocol_id` metadata. It must not deduplicate by display name or assume a particular Universal Player ID format.

For the normal controller:

- `players` contains canonical/user-facing players;
- `protocolPlayers` retains linked protocol children for troubleshooting;
- `playerAliases` records child-to-parent routing;
- player commands and queue commands are rewritten to the canonical parent where required.

Background Music queue operations must use the Universal Player queue. A protocol child can be available for Sendspin transport while having no independent Music Assistant queue.

A Play/Pause request can still fail legitimately when an idle player's queue is empty. Load media first, then pause/resume the queue.

The CAST-1 ESPHome API also exports both `Sendspin Player` and `Player` media entities. Those are legitimate entities within the single ESPHome device and must not be confused with the Music Assistant Universal Player/protocol-child relationship.

See `docs/MUSIC-ASSISTANT-PLAYER-ROUTING.md` and `test/music-assistant-universal-player.test.js` for the implementation and regression contract.
