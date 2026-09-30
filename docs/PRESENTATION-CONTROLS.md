# Presentation controls

Select a rendered presentation in Presentations. Previous, Next, Go and slide
thumbnails work before Start: they update the local preview, notes and starting
slide without sending content to any receiver. Preview navigation is clamped to
the first and last slides. Start uses the selected starting slide and TV targets.

Start first clears text, titles, subtitles, timers, identification and media on
the selected displays, then sends the slide. Other displays keep their content.
Subsequent slide changes do not clear between slides, avoiding a black flash.
Existing receivers remain compatible through `display.clear` and `display.image`.

When the selected deck is live, navigation controls operate that live deck.
Selecting another deck allows previewing it without changing the live deck;
state polling does not replace that selection. Pause, Black Screen, Stop and
timing controls retain their live-session behavior.

Morning Announcements retain priority: start validates the requested targets
before replacing a prior presentation, and every presentation display command
checks announcement priority again at dispatch. Silent slides do not acquire
audio priority or pause Background Music. Scheduled automation is unchanged;
pause it using the existing automation controls when a presentation must remain
on screen through a scheduled content change.

Validation: `node --test test/presentation-controls.test.js`, `npm run check`,
and `npm test`. On physical receivers, start over text/timer/video content,
verify only selected TVs clear, navigate without flashes, and verify preview
navigation sends nothing until Start. Repeat with Morning Announcements active.
Use the normal backed-up production updater; rollback follows the normal source
and image recovery procedure. No data schema or receiver identity changes occur.
