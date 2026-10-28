# Music bridge action and dispatch ordering

Baseline: `3b448cf4811cb8876c725073dbf64ceeb8d7a639`. Three actual-route
reproductions fail: overlapping attach/detach dispatch, unknown action accepted
as attach and remaining targets dispatched after a connection replacement.

## RG-MUSIC-017: Bridge changes outlived action and connection ownership

Attach loop deliveries could continue after a later Detach, leaving desired
attachment preferences inconsistent with command order. A connection change
could also retarget remaining tickets, and arbitrary actions acted as Attach.
This is P1 for ordering/connection ownership, P2 for action validation.

Serialize accepted bridge-handler promises, reading the latest desired targets
inside each operation. Validate the fixed attach/detach action before queueing.
Capture the connection generation at admission and recheck before work, between
targets and after delivery. Retired work requires refresh. Errors release the
queue, while later explicit operations retain their own order.

The command router accepts a conditional Music Assistant generation only for
internal bridge attach/detach commands. Recheck after asynchronous admission and
between transport deliveries; retired work cannot write remaining transports or
apply current command observation. Preserve existing announcement-content guards,
selected targets, one-use same-Hub tickets, protected player IDs and writer drain.
The default omitted action remains Attach.

Desired attachment state is persisted before delivery, as before. Partial or
uncertain physical dispatch cannot be silently undone; errors stay visible and
are not automatically replayed. This is not a hardware transaction rollback.

## Qualification and delivery boundary

All 18 new cases (12 actual-route and six actual-router cases) and all 62
expanded bridge/announcement/audio checks pass. The first run's three preference
comparisons differed only in cross-context Array prototypes; copying those
fixture values into the host context preserves the exact value assertions.
Coverage includes queue lifetime, latest-state merging, connection retirement,
invalid actions, missing token, errors/retry, preserved long IDs, admission,
WebSocket/MQTT races and rejection of unrelated conditional dispatch.

The supported Linux snapshot passes 1,648 tests with zero failures and two
root-only skips (1,650 total), plus all 23 Host Recovery tests and the supported
Node/controller/Python/Bash checks. Required gates, exact images and backed-up
appliance delivery remain pending. No physical classroom commands, receiver reloads or
production fault injection were used. The broader modernization remains active.
