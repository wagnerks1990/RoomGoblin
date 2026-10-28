# Presentation session and folder deletion ownership

Baseline: PR #309 head `e2a3cb31c41bcaa9f5a25dbca63ad74d767a57df`.

## RG-PRESENTATION-002: Slide dispatch crossed session boundaries

An actual-source reproduction held the initial clear, replaced the live session,
and observed the old slide URL being sent to the successor's receivers. Starts,
controls and deletion now share an ordered session owner. Dispatch snapshots its
slide and receivers and checks ownership after transport waits. Queued controls
reject a replaced session; optional client `sessionId` also guards stale views.
Automatic advancement rechecks its slide occurrence, pause and elapsed time.
Failed operations release the queue without replaying an uncertain command.

## RG-PRESENTATION-003: Folder deletion removed a live deck without stopping

The actual folder route deleted a nested live deck without stopping it. Recursive
deletion now stops the live session before removing files and remains ordered
with accepted starts. A failed clear preserves files and folder records.
Membership is recomputed after the stop wait: moved-out decks survive and newly
registered members are included. Unrelated folders do not stop the live session.

## Validation

Twenty-five new regressions and all four existing presentation-control cases
pass. Four new cases use actual routes, loopback HTTP and the application handler
tracker to prove queued start, control, deck deletion and folder deletion remain
counted after browser disconnect. Existing announcement admission, selected-only
start clearing, silent-slide audio behavior and flash-free navigation remain.

The backend snapshot passes 1,844 Linux tests with zero failures and two root-only
skips (1,846 total), plus all 23 Host Recovery tests and syntax/controller checks.
This snapshot predates the following frontend changes. Combined qualification
and checked GitHub/appliance delivery remain pending.
These tests do not exercise physical displays or claim atomic filesystem/database
deletion.

## RG-PRESENTATION-001, 004, 005: Controller intent was overwritten

Actual-source tests reproduced a late live-control reply replacing a newer preview
selection and polling replacing focused timing drafts. An actual-browser test
reproduced library refresh reselecting a receiver the operator had unchecked.

Commands now retain browser acceptance order and send the viewed live session
identity. State/library reads retain separate response ownership; reads cannot
replace a later command. Live replies preserve the current preview selection.
Timing, jump and loop drafts remain through focus and blur until acknowledged;
changed sessions reset their settings. Receiver controls retain keyed DOM nodes,
choices and focus. After initial population, newly discovered receivers start
unchecked. Unchanged thumbnails also retain their DOM nodes and keyboard focus.

Nineteen additional Node regressions and three Chromium cases pass, including
overlapping starts, failed-queue recovery, stale state/library responses, current
errors, focused/blurred drafts, successor settings, target changes and preview
selection. State reads also share one pending request, preventing slow periodic
responses from continually superseding one another; failures release that owner.
Full combined Linux and both-browser qualification remain pending.

## RG-PRESENTATION-006: Empty receiver selection expanded to all displays

Two actual-route regressions reproduced an explicit empty receiver array falling
back to all displays or the legacy single target. Empty arrays now fail before
stopping the prior session or dispatching. A third regression uses the actual
target resolver to preserve the omitted-target legacy default. The final focused
set has 51 passes: 47 new cases and four existing presentation-control cases.

## Final combined qualification

The supported Linux snapshot passes 1,866 tests, zero failures and two root-only
skips (1,868 total), plus all 23 Host Recovery tests and Node/controller/Python/
Bash checks. All 76 workspace cases pass in Chromium (87.960 seconds) and Firefox
(116.392 seconds), including the three new cases. The earlier combined Linux run
passed 1,861 tests with two skips; the final run also includes polling coalescence
and explicit-empty-target regressions. The earlier 76-case Chromium pass preceded
those final changes and is not used as their qualification.

Required PR/main checks, exact images and backed-up appliance delivery are pending.

Integration on merged main `86ce127` produced a complete tree byte-identical to
qualified `e1b534e` before this evidence note. All 51 focused integration checks
also pass. PR #309's backed-up delivery is verified in the linked audit receipt.

## Security-gate repair

CodeQL on `da4309b` reported missing rate limiting on the newly queued start,
deck-delete and folder-delete routes. They now share a fixed 30-per-minute
appliance budget before authorization/session admission, using the same accepted
caller predicate as the capability guard. Live controls remain independently
available. Four actual HTTP/limiter regressions cover shared route/IP budgeting,
rejected users/tokens and Stop after exhaustion; all 55 focused checks pass.
The final Linux rerun passes 1,870 tests, zero failures and two root-only skips
(1,872 total), plus all 23 Host Recovery tests and Node/controller/Python/Bash
checks. Frontend source is unchanged from the 76-case passes in both browsers.
Fresh GitHub gates remain pending. No gate is suppressed.

## Follow-up still open

RG-PRESENTATION-007: an actual rebuild-route reproduction sent two requests that
shared one controlled converter rejection. The final record was `converting`
instead of its earlier `ready` state because both handlers restored their own
captured status. This reproduced failure remains for the next conversion-owner
repair; it is not part of the completed session/controller changes above.
