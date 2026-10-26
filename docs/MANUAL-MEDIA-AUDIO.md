# Manual Media Audio Controls

The Display Content → Media → Manual / Selected Media panel includes an explicit playback-volume control for manual video and web/stream playback.

## Behavior

- The volume slider is expressed as 0–100% in the controller.
- The display command payload carries normalized `volume` from `0.0` through `1.0`.
- Selecting 0% also mutes playback.
- Selecting the Muted checkbox drives the slider to 0%; unmuting restores the prior non-zero level when available.
- Manual video commands carry both `muted` and `volume`.
- Manual web/stream commands also set `forceAudio` when volume is above zero so the receiver's existing web-audio recovery behavior is used.
- `localDirect` remains controlled by the existing "Load URL directly from this TV/browser" checkbox.

This control sets manual playback defaults. Morning Announcements retain their
dedicated announcement-volume control. For current automated video, website and
Sports sound, use [Live audio in Automation or Sports](AUTOMATION-DISPLAY-MEDIA.md#live-audio-controls).

## Replacing displayed content

Showing an image, video, web page, PDF or converted document from Display Content
or the Media & Document Library clears the selected receivers before sending the
new content. Manual full-scene commands use the same replacement path. The Hub
validates the content and targets before clearing, sends the existing
`display.clear` command for receiver compatibility, and clears persisted state
so reconnecting receivers cannot restore old overlays. Text, titles, subtitles,
scene/shared layers, timers, identification, presentation blackout and prior
media are removed. Other receivers keep their content.

Receiver media cleanup pauses and unloads the retired video and blanks its web
frame. Late playback promises and events from the retired video cannot restart
its audio, alter the new session or report that the new content ended. Live
play/pause/seek/volume controls and same-session replay retain the current video.
Individual text/title/subtitle/timer edits remain composable overlays.

Morning Announcements block manual replacement and clear on their locked targets,
including a second check after asynchronous delivery. Manual video and audible
web playback acquire the existing classroom audio takeover before clearing;
silent images/documents do not pause Background Music. Hallway-only playback keeps
its independent audio scope. Resume Scheduled State retains its existing release
behavior. Presentation navigation and automation keep their own clearing policy.

Regression coverage: `test/manual-content-replacement.test.js` exercises the real
router, state updates and library Show handler; `test/browser/test_display.py`
checks cleanup, delayed video callbacks and persistent media controls in the real
receiver DOM. Physical acceptance still requires switching from scene/timer/video
and web audio to each new content type on selected receivers, checking sound and
reconnects, and repeating with Morning Announcements active. No schema migration
or receiver identity change is required; rollback uses the normal backed-up
source/image update procedure.
