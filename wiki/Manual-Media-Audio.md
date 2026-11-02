# Manual Media Audio

Use **Display Content → Media → Manual / Selected Media** to play an external/manual video or web stream at a chosen volume.

The controller exposes a 0–100% playback-volume slider. Volume is sent to the display as a normalized `0.0`–`1.0` value. Setting volume to 0% mutes playback. Selecting **Muted** also sets the effective volume to zero; clearing Muted restores the prior non-zero slider value when possible.

For web/stream playback with non-zero volume, RoomGoblin requests the receiver's existing forced-audio recovery path. This is separate from the Morning Announcements volume setting.

Showing media from Display Content or the Media & Document Library first clears
the selected displays, including old scenes, text, timers, blackout and media.
The prior video is stopped and unloaded and web frames are blanked, preventing
old playback from overlapping the new content. Reconnecting displays receive the
replacement state. Unselected displays retain their content.

Morning Announcements keep priority and block replacement of their targets.
Manual video and audible web playback retain the classroom audio takeover;
silent images and documents leave Background Music available. Hallway-only
playback keeps its independent audio scope. Use Resume Scheduled State to release
an existing manual takeover. Individual text/title/subtitle/timer edits and live
media controls retain their existing overlay and persistent-session behavior.

For current automated video, compatible website and Sports sound, use
[Live audio in Automation or Sports](Automation-Display-Media#live-audio-controls).
These controls change current playback; saved action settings apply on the next run.
