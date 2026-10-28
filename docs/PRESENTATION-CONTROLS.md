# Presentation controls

Select a rendered presentation in Presentations. Previous, Next, Go and slide
thumbnails work before Start: they update the local preview, notes and starting
slide without sending content to any receiver. Preview navigation is clamped to
the first and last slides. Start uses the selected starting slide and TV targets.

Start first clears text, titles, subtitles, timers, identification and media on
the selected displays, then sends the slide. Other displays keep their content.
An explicitly empty receiver list is rejected before replacing the live session;
omitting targets retains the legacy API default.
Subsequent slide changes do not clear between slides, avoiding a black flash.
Existing receivers remain compatible through `display.clear` and `display.image`.

When the selected deck is live, navigation controls operate that live deck.
Selecting another deck allows previewing it without changing the live deck;
state polling does not replace that selection. Pause, Black Screen, Stop and
timing controls retain their live-session behavior.

Late live-control replies preserve the selected preview. Controller commands
keep acceptance order and include the viewed live session identity; older reads
cannot replace newer command results. Periodic state reads share one pending
request so slow polling can complete. Refresh preserves receiver choices,
including selecting none, and newly discovered receivers start unchecked after
the initial target list. Timing, jump and loop drafts survive polling and blur
until acknowledged or the live session changes. Unchanged thumbnails retain
keyboard focus.

Starts, live controls and presentation deletion share an ordered session owner.
Queued controls retain the session they were accepted for; a successor session
rejects them with HTTP 409. Clients may supply `sessionId` to also reject a stale
browser view. Automatic advancement rechecks its slide occurrence, pause state
and elapsed time after waiting. Commands keep their captured slide and receivers.
Deleting a folder containing the live deck stops it before removing files; a
failed clear keeps those files available. Folder membership is checked again
after that wait so a deck moved out is preserved.

Accepted HTTP handlers return the complete queued operation, including after
browser disconnect. Shutdown and Full Recovery therefore retain their existing
writer-drain ownership; automatic advancement keeps its existing busy owner.

Start and deck/folder removal share a fixed appliance-wide limit of 30 accepted
requests per minute, checked before session admission. Rejected authentication or
capability checks do not consume it. Live controls, including Stop, stay available
when that start/removal budget is exhausted.

Morning Announcements retain priority: start validates the requested targets
before replacing a prior presentation, and every presentation display command
checks announcement priority again at dispatch. Silent slides do not acquire
audio priority or pause Background Music. Scheduled automation is unchanged;
pause it using the existing automation controls when a presentation must remain
on screen through a scheduled content change.

Validation: `node --test test/presentation-controls.test.js test/presentation-session-ownership.test.js test/presentation-controller-ownership.test.js`, `npm run check`,
and `npm test`. On physical receivers, start over text/timer/video content,
verify only selected TVs clear, navigate without flashes, and verify preview
navigation sends nothing until Start. Repeat with Morning Announcements active.
Use the normal backed-up production updater; rollback follows the normal source
and image recovery procedure. No data schema or receiver identity changes occur.

## Interrupted conversion recovery

Rebuild returns HTTP 409 while that deck already has an upload or rebuild render
in progress. The accepted render keeps ownership of its status and assets; a
duplicate request cannot leave a failed conversion marked as still converting.
After it finishes, a later rebuild can retry normally. Different decks retain
independent conversion owners.

A conversion interrupted by a service restart remains failed/rebuildable unless
an earlier rendered deck is available. Its original file is retained. At startup,
RoomGoblin reclaims only recognized private render staging, before new conversion
work begins. Cleanup is bounded and rejects linked, special, foreign-owned or
changed entries; unknown uploads are preserved. A warning means some staging
needs inspection, not that the original presentation was removed. Rebuild uses
the retained original and the normal atomic publication path.

Tests exercise the actual shutdown deadline, restart cleanup and successful
rebuild with a controlled rasterizer. They do not qualify rendered slide quality
or physical presentation playback. See [Application lifecycle](APPLICATION-LIFECYCLE.md)
for the cleanup budgets and writer-drain contract.
