# RoomGoblin Chess Arena — MVP (feature branch)

## Scope and status

The universal Chess Arena is a first-release prototype for the existing RoomGoblin learning platform. It is **not production or Schoology-qualified** until the Node integration tests, browser smoke tests, genuine Schoology SCORM 1.2 launch/grade/resume verification, and backup/rollback checks pass. Never deploy this branch directly to the classroom appliance.

- Teacher workspace: `/learn/chess` uses the existing RoomGoblin teacher login and teacher APIs. It can observe the global lobby, view active matches and recently connected student clients, and join the queue to play.
- Student launch: Create a 20-point SCORM connection in `/learn` and select **Download Chess SCORM package**. Upload the ZIP as a SCORM 1.2 package into Schoology. No independent student RoomGoblin password or roster import is required.
- All packages on this RoomGoblin instance share the same waiting-match lobby, regardless of their original class or assignment.
- Modes: peer-to-peer multiplayer, self-play, and a deterministic beginner computer opponent. No external services/CDNs, separate databases, or additional publicly accessible ports are added.
- MVP grading: five validated player moves count 4 points each, max 20. Winning is **not** a requirement. This measures participation, not strategy. Schoology remains authoritative for its LMS grades; a SCORM runtime and successful commit are required.
- Dashboard updates are *polling* approximately every 3 seconds (not WebSockets). Student heartbeats are sent about every 10 seconds while visible. Connected means recently seen by the app, not attendance or verified physical presence.

## Student identity and privacy

The existing direct-SCORM SDK reads `cmi.core.student_id` and `cmi.core.student_name` (or SCORM 2004 equivalents) and submits the **reported** ID and name automatically to the assignment enrollment endpoint. Each session receives a private, random participant bearer bound to its own assignment, independent of the visible name. No additional password form is added. SCORM-reported identity is **not cryptographic identity verification** and must not be treated as verified attendance, discipline evidence, or proof of work by a particular person.

The stored full name is available only through teacher-class-authorized projections; cross-class lobby viewers receive a first name and last initial, and never other students' user IDs. Use school-approved privacy procedures before encouraging students across classes to participate. A downloaded ZIP contains a *registration-only* enrollment key, not a teacher token.

## Universal leaderboard and identity scope

The Chess Arena leaderboard is visible in both the SCORM student UI and `/learn/chess`. It is calculated from authoritative SQLite match records instead of client-supplied statistics. One completed multiplayer game contributes at most one result per participating account; retries and page refreshes do not grant additional wins. Win/loss/draw standings count only finished real multiplayer games with at least four half-moves, and exclude expired queues and inactive games. Solo and computer games appear as **practice counts only**; they cannot increase multiplayer ranking. The display shows up to 100 player entries, with the total number of participating player accounts reported separately.

Other students see opaque, stable per-account labels (not names or account IDs) on leaderboard rows. Authorized teachers may see an LMS-reported full name only for a participant belonging to one of their assigned classes. Schoology names are still shown in the match lobby as a limited first name and initial. This distinction is intentional.

**Identity limit:** The existing direct-SCORM flow creates a private participant account for each distinct assignment package/credential. The leaderboard aggregates matches across classes but may show multiple entries when the same human launches different assignments. It is therefore an *account leaderboard*, not a verified unique-person leaderboard. Do not auto-merge accounts by reported name, as names are unverified and not unique. A later verified identity/consent design is required for verified person rankings.

## Data and security architecture

`src/learning-chess.js` owns rules, persistent SQLite match state, turn authorization, join conflicts and game outcome. `learning_chess_matches` records moves in UCI format, match revisions, source assignment, second player's source assignment, and mode. `learning_chess_presence` tracks last-seen heartbeats. Matchmaking across classes never grants a second assignment's data access.

Existing student-only gateway at loopback `3030` remains the only public student backend. Exact `/api/v1/learning/direct/activities/:id/chess` routes use the existing assignment-scoped bearer and are rewritten into the standard learning API. The SCORM SDK accepts only its configured activity ID and the defined chess subroutes. Authentication on `/learn/chess` continues through the normal RoomGoblin teacher session. The gateway must never serve the teacher dashboard, the underlying administration assets, or the teacher APIs.

The service validates legal moves on the server including castling, en passant, promotion, king safety, checkmate, stalemate and automatic draws; clients provide UCI moves and the most recent revision. It does not use a client-submitted board position to establish a result. Waiting slots expire after 30 minutes, and inactive games after seven days (opportunistically on match creation). Maximum 250 open/active games and 512 half-moves per game. Users can cancel waiting games, resign active multiplayer matches, or stop practice.

Teacher participation uses an already-existing SCORM activity in a class to retain authenticated activity/session boundaries. Select a class with a configured SCORM assignment before joining the queue. This is an MVP limitation, not a new teacher password requirement.

## Acceptance checklist

1. Run `node --check` on changed CommonJS and browser JavaScript, followed by `node --test test/learning-chess.test.js` and existing learning API / direct gateway / regression tests.
2. Use two isolated users enrolled through distinct SCORM packages. Verify both appear in the same queue; one joins, alternating legal turns update both views; illegal, stale, out-of-turn and unassociated-user moves are rejected.
3. Confirm teacher spectator can watch all games but an unrelated student cannot read another player's in-progress private match through its ID; peer display names are reduced and teacher full names are class-authorized.
4. Confirm the Schoology runtime supplies a learner name automatically, registers without a RoomGoblin password, and reliably stores the random participant bearer in LMS suspend data. Closing/reopening must resume without creating a second user.
5. Test solo/computer play, game cancellation, resignation, checkmate, stalemate, promotion and special moves; verify actual SCORM score (0–100%), completion, and gradebook updates.
6. Confirm 3030 denies `/learn/chess`, `/learn/chess/app.js`, `/api/v1/learning/teacher/chess`, `/controller/`, and all unrelated routes. Validate CORS and browser security policies on actual school network.
7. Test Schoology browse/review mode read-only, assignment close/pause, backup/mutation freeze, connection revocation, and that source assignment scope is preserved after cross-class joining.
8. Verify unaffected Morning Announcements, display receivers, scheduled events, Background Music, lab management, and working SCORM assignment exports.
9. Check the final PR diff, no bundled production secrets, CI security gates, and the published application image before merging.

## Deployment / rollback

No configuration change or migration should be made to a live appliance until acceptance. All changes are additive to the existing SQLite schema. Preserve `/opt/classroom-hub`, class identifiers, enrollment records, learning data, backups, device mappings, and legacy compatibility identifiers. Take a reviewed backup before updating and use the existing main-based, image-verified updater when merging is approved. Roll back code and compatible database backup together when a schema or data rollback is required.

## Future expansion

A second release can add a dedicated verified user identity bridge, optional display names/consent policies, friend invites, chess clocks, Elo/rating, tournaments, more challenging AI, puzzles, teacher-created objectives and rubric-specific scoring. None should be treated as implemented in MVP.
