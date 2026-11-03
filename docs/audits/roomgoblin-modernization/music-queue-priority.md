# Existing music queue: priority ownership

Baseline: alpha.86 main `518d4a22e9420818d47269786556be5c293332e8`, delivered
by [PR #358](https://github.com/wagnerks1990/RoomGoblin/pull/358). That release
made Music Studio Play preserve the selected queue and volume. Its checked
images and operational backup were verified on the appliance.

## Finding and correction

Play on an output other than the currently managed player used the generic
Music Assistant command endpoint. The queue resumed correctly, but Background
Music retained the earlier player identity. Announcement priority and sleep
therefore could not manage the newly selected queue.

Music Studio now sends Resume through the managed control handler with the
selected output. Before adopting an existing queue, the backend checks player
availability and stops the previously owned output. Session and priority checks
after awaited operations reject retired work. No queue replacement, volume or
mute command is sent. The existing late-play priority/Stop compensation remains.

Existing-queue ownership is explicitly process-local. Priority release resumes
that queue after the existing display reconciliation; sleep and manual controls
use the same owner. The watchdog observes this mode without replaying an idle
queue or falling back to the scheduled favorite. Recover playback explicitly
resumes it. Explicit source selection retains its existing automatic recovery.

## Validation boundary

The initial actual-function regression run reproduced 13 failures with 30
passing controls on the baseline. Expanded coverage includes selected-player
adoption, unchanged source/volume commands, priority pause/release, unavailable
outputs, current source preservation, Stop/priority/successor races, uncertain
responses, watchdog non-replay, mode reset, multi-track boundaries and the actual control handler.
All 105 focused native Linux music tests pass; the transport, studio and queue
browser suites pass all 28 cases in each of Chromium and Firefox. Full validation
and delivery are recorded in the associated pull request.

Before the change, an authorized live test used the existing 50-item Apple Music
queue at volume 6. Pause retained its position and Resume advanced from that
position without changing items or order. This receiver reports idle after Pause.
The original idle state, volume 42, queue order and position were restored.
Player-reported progress is not physical confirmation of audible sound.

Announcement take-over/release acceptance for this fix remains separate until
recorded in the delivery receipt. No production failure injection, credential
change or persistent music-schedule change was used for the reproduction.
The pending-command Stop-button restriction remains a separate UI follow-up.
