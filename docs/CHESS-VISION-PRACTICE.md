# Square finder practice

The original RoomGoblin Square finder is a local coordinate-recognition exercise.
It names a square on an empty board; the learner selects that square. It does not
load a match, calculate a tactical move, call an API, read an account, persist
results or report grades. Accuracy means correct answers divided by local
attempts, not verified mastery, playing strength or competitive rating.

`public/learn/chess/vision.js` exposes `new RGChessVision(container)`. Load
`vision.css` and the script locally before creating it. The container belongs to
the widget: instantiate once rather than replacing it during ordinary game polls.
Call `destroy()` before its owning teaching panel or learner context is removed.
The optional `pause()`, `resume()`, `stop()`, `reset()` and `getStats()` methods
support parent lifecycle management. `getStats()` returns only local attempts,
correct count, running/paused state and remaining seconds.

Untimed practice is the default. The learner may choose a 30- or 60-second round,
White or Black at the bottom, and whether square names appear visually. Accessible
square names remain available when visual labels are hidden. A wrong answer
retains the target and explains its file/rank. A correct answer advances to a
different square. Stop retains local counts; Reset clears them. Closing/destroying
the owner discards all local results.

The board uses one roving tab stop. Arrow keys follow the visible orientation;
Home/End move across the row, Ctrl+Home/End move to the first/last visible square,
and native Enter/Space activate the focused button. Escape pauses practice.
Mouse and touch use the same guarded answer handler. Feedback includes text and
symbols rather than color alone. The timer is not a repeatedly announced live
region, and the next target/answer feedback is announced politely.

One bounded interval is active only during a running round. Elapsed time comes
from the monotonic browser clock. A hidden document or hidden parent container
pauses the round and clears the interval; returning does not restart it without
the learner pressing Resume. Stop, Reset and Destroy clear timers. Destroy also
removes listeners and prevents subsequent method calls from restarting practice.

`test/browser/learning-chess-vision-smoke.cjs` uses a synthetic offline page and
fake elapsed time to cover orientation, keyboard/touch answers, correct/wrong
counts, hiding/explicit resume, expiry, reset and destruction. It checks that the
widget does not write to a stub LMS API or request outside resources. Integration
into the real exported SCORM and actual Schoology acceptance remain separate.

## Integrated private guided lessons (2026-11-20)

Both teacher Chess Control Center and exported SCO load `vision.js`, `vision.css`
and `training.js` before the coach. The coach retains the practice instances across
live-game polls, pauses Square finder when gameplay is paused/read-only and destroys
both when the learner changes or the page closes.

Guided board practice uses six server-authored lessons. Load / refresh retrieves
only the current participant's progress; Start / restart creates a fresh attempt.
The server validates every attempted move and objective. Revealing hints records
assisted practice separately from completions without hints. The shared accessible
board supports dragging, keyboard selection and all four promotion choices.

The UI passes exact revision and request IDs to `training/start` and
`training/sessions/:id/{attempt,hint}`. A failed mutation locks the lesson until
refresh; it is never automatically replayed. Changing class/learner invalidates
late replies and clears the prior private lesson. No lesson or Square finder event
writes SCORM grades, multiplayer results, attendance, or classroom effects.

Validation: `test/browser/learning-chess-training-smoke.cjs` exercises actual
exported SCO and teacher pages, including saved assistance counts, fresh unassisted
completion, package manifest assets, unchanged SCORM score and phone containment.
This synthetic LMS check does not establish live Schoology acceptance.
