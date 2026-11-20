# Chess Arena UX and lifecycle review

Reviewed 18 November 2026 against the actual teacher, exported SCORM and local TV pages. All browser checks use temporary local services and fictional learners. This review does not establish live Schoology, physical classroom, assistive-technology or production acceptance.

## Prioritized findings and fixes

| Priority | Evidence / failure | Implemented behavior | Regression evidence |
| --- | --- | --- | --- |
| P1 | A lobby GET started before a new game could return after the create response and replace the entire list, briefly erasing the confirmed game. Revision checks alone did not protect newly inserted rows. | Teacher and SCO reads carry a state epoch. Reads crossing a write are discarded and followed by a fresh read. Validated move progress is refreshed from the same accepted snapshot. | Deliberately held pre-creation GETs in teacher and exported-SCO browser tests. |
| P1 | A failed or uncertain POST immediately re-enabled the cached legal-move board. | Cached actions lock while reconnecting. Only fresh authoritative reads restore controls. Failed writes are never automatically replayed. Online/visibility recovery requests reads only. | Aborted move POSTs and blocked GETs; controls remained locked, one POST was observed, and reconnect restored the unchanged server position. |
| P1 | Every teacher HTTP 403 redirected to login, including operational action denials. | HTTP 401, or a denied teacher workspace/catalog read, retires the teacher view. A denied POST reports the action error and retains the authenticated workspace. | A denied practice request retained `/learn/chess`; backend operational-status contracts were inspected. |
| P1 | Invalid private SCORM credentials could leave a cached private board visible; actor cleanup left old move counters and serialized render signatures. | A private-request 401 clears the board, lessons, leaderboard, move/progress counters and action access until reopening. Actor checks do the same immediately when the LMS identity changes. Render caches no longer serialize player/match data into DOM attributes. | Revoked-connection and changed-actor SCO browser checks assert empty private views, reset counters, disabled actions and no retained data signatures. |
| P2 | Leaving an active game was one click, with the same wording for cancelling a queue, stopping practice and forfeiting multiplayer. | Named confirmation dialogs explain the specific outcome, focus the safe choice, support Escape and restore focus. The selected match and revision are checked again after confirmation. Cancelled queues and stopped practice have distinct banners rather than competitive-draw labels. | Cancel, focus recovery, a server revision changing while the dialog was open, and confirmed practice closure. |
| P2 | Selecting a teacher waiting-game card joined immediately; finished and open games were mixed without ownership filters or bounded-history context. | Cards select/watch. Joining requires the explicit Join action. State, ownership and name filters separate open, waiting, active and finished games. Counts use server totals; recent finished history reports returned/total/limit. | Watch without joining, explicit Join, filters, totals/history labels and refreshed-card focus checks. |
| P2 | The interface lacked a safe way to tidy a class-owned waiting request without affecting a game. | Only server-authorized waiting rows expose Remove waiting request. A separate confirmation says no result is recorded and the learner can queue again. The revisioned teacher-only endpoint rechecks class authority and waiting state. | Browser confirmation/cancel/cleanup and result-exclusion checks; backend lifecycle tests cover authority and join races. |
| P2 | Keyboard users tabbed through every square; left/right wrapped across rows, and flipping or rebuilding lists could lose focus. | One board tab stop, bounded arrows, Home/End and Ctrl+Home/End, selected/legal-target descriptions, visible key help and stable focus across rotation/polling. Game-list selection restores focused cards. | Real keyboard input, board rotation, refresh and match-revision tests. Native mouse/touch dragging remains covered. |
| P2 | Cached clocks can reach zero before a fresh authoritative result arrives. | Both participant and spectator clocks remain estimates. Zero says Awaiting server; reconnect labels the estimate. The browser never awards a timeout. | A timed spectator game with reads blocked remained without a client-declared result; a fresh read displayed the server timeout. |
| P3 | Win-type abbreviations and move-average units required interpretation on wide/rotating standings. | Table legends explain W/L/D. TV descriptions distinguish outcomes and explain that averages count each player's own moves, with checkmate-only averages separate from all wins. | Actual synthetic TV/dashboard screenshots inspected; auto-updating TV regression retained. |

## Lifecycle contract

- Untimed active games remain saved and resumable until an explicit ending or normal chess result. Age or loss of a recent heartbeat does not forfeit or delete them.
- Timed clocks may continue while a browser is closed. A cached countdown is not result authority.
- `queueFresh` describes recent app activity within the server's freshness window. It is not verified attendance or a guarantee that the participant is currently online. Joining still depends on `canJoin` and fresh server authorization.
- A learner may keep up to 12 open games. The teacher dashboard explains the limit and disables new-game controls at that user's capacity; existing games remain selectable.
- Manual teacher cleanup removes only an authorized waiting request. It never deletes history, forfeits another participant's active game, clears competitive statistics or schedules automatic cleanup.
- Teacher reads include all admitted open games plus the bounded recent-finished window. The interface labels the 100-result history window; searching it is not a search of every historical finish.
- Waiting-request cancellation and stopping practice are not competitive draws. Forfeit, checkmate and timeout outcomes remain distinct server-owned statistics.

## Validation

From the active checkout, with the documented separate Playwright/Edge installation available:

```sh
npm run check
node test/browser/learning-chess-ux-smoke.cjs
node test/browser/learning-chess-coach-smoke.cjs
node test/browser/learning-chess-interaction-smoke.cjs
node test/browser/learning-chess-smoke.cjs
```

The targeted UX suite covers 10 browser groups. The teaching/SCO suite includes package-manifest coverage, learning, stale hints, read/write races, reconnect, private-credential retirement and actor cleanup. Existing interaction and SCORM regression suites each cover 9 groups. Results must be reported from the actual run; the native Linux regression runner remains a separate release check. Synthetic controller, confirmation and TV screenshots were visually inspected without real student data.

## Remaining limitations and next work

1. Live Schoology launch, suspend/resume and grade acceptance still require provider testing. Mock LMS success is not provider acceptance.
2. Actual screen-reader/browser combinations and physical touch devices need acceptance testing. Automated keyboard and native Chromium touch tests are useful evidence, not a complete accessibility certification.
3. Finished history has a truthful bounded window; historical server pagination/search would be a separate enhancement. No history is erased by this UI.
4. There is no automatic abandoned-active-game cleanup, bulk forfeit, game deletion or global reset control. These would conflict with the saved-game contract without a separately reviewed policy.
5. User-facing last activity is descriptive, not proof of identity, physical presence or attention. Public/student names remain first name plus last initial; full teacher names remain class-authorized.
6. Cinematic-next art/choreography is developed in its isolated worktree. This UX review does not claim that separate prototype is integrated, classroom-GPU qualified or movie-quality.
