# RoomGoblin Chess Arena

Teachers monitor and play at `/learn/chess`. Create a SCORM assignment in `/learn`
and download its Chess SCORM package. Schoology supplies the reported learner
name and ID automatically; no separate student password is required. Enrollment
creates an isolated participant with a private bearer saved in LMS suspend data.
Reported names never verify identity, authorize attendance or merge accounts.
Different assignments can therefore give one human separate leaderboard entries.

## Play, resume and clocks

The shared board supports dragging, native touch, tap and keyboard play, with the
player's color at the bottom. Solo follows the active color. Teacher controls
resize, flip and focus the board. Last moves, check and game endings have distinct
cues. Sound defaults off and reduced motion is respected. Polling preserves nodes
and interactions. Optional 3D uses original articulated stone warriors, local
Three.js, lighting, shadows and capture effects. It remains stylized prototype
art, not film-quality realism. GPU failure falls back to 2D. See
[cinematic design and asset licensing](CHESS-CINEMATIC-PLAN.md).

All classes share matchmaking. Each seat retains its original assignment and
private bearer scope. Both must retain access before matching or moving. Up to
12 waiting/active games per account are saved, with an instance limit of 250.
Untimed games do not expire through inactivity. Unique persisted creation request
IDs make retries idempotent while allowing multiple games. Legacy clients retain
resume behavior. Automatic matching uses recently connected waiting players.
Students can cancel queues, forfeit multiplayer or stop practice; normal chess
endings also finish games.

Clocks: untimed, 3+0, 5+0, 5+3, 10+0 and 15+10; solo is untimed. The server owns
remaining time, increments and flag results. Browser countdowns are estimates and
never declare wins. Timed games continue while disconnected. Assignment pauses
or closure suspend clocks when reconciled. Clock processing respects writer
freezes and shutdown admission; failures remain visible. Server downtime is
charged from stored wall-clock anchors on restart; reliable system time matters.
Beginner, Standard and Advanced computer levels use bounded worker-thread search,
not rated strength claims. Participation grading remains five validated player
moves at four points each, capped at 20; winning is never required.

## Rules and statistics

Server legal moves cover king safety, castling, en passant, four promotions,
checkmate and stalemate. Threefold repetition and 50 moves require claims, including
an optional legal intended move. Fivefold and 75 moves are automatic; mate takes
precedence. Players can agree a draw after both have moved. Forfeit/timeout use
supported mating-possibility checks. See [the rules audit](CHESS-RULES.md) for
coverage, perft evidence and conservative dead-position limitations. This is not
certification of every composed position or over-the-board tournament procedure.

SQLite results drive games, wins, losses, draws, win rate, separate checkmate,
forfeit and timeout outcomes, own-move averages, fastest completed mate and win
streaks. Early forfeits are visible results, never disguised as checkmates.
Ranking prioritizes checkmate wins, then total wins and tie breakers. Computer and
solo statistics are separate. Cancelled queues/stopped practice are not competitive
draws. No speculative mate-in-N prediction is shown. Existing native deletion
contracts remove related matches and derived statistics.

Student and TV standings show first name and last initial with opaque stable row
keys. Full names require teacher membership in that student's class. Private IDs,
grades, assignment IDs and credentials never belong in public standings.

## TV display and isolation

Use the local RoomGoblin URL ending in `/chess/leaderboard` as an HTML TV source.
It polls the narrow read-only `/api/v1/chess/leaderboard` projection and rotates
statistics/pages without reloads. It requires an initialized appliance, no teacher
session, and is unavailable through the public student gateway/public transport.
No receiver is automatically reserved; announcement/music/scheduling priority is
unchanged. Operators must apply their school's name-display policy.

The exact isolated learner gateway method/path allowlist includes scoped chess
and draw actions, never teacher pages/APIs, teacher assets or TV routes. Cookies
are not participant authority. Server revisions, assignment availability and
private bearers remain mandatory. Computer HTTP promises participate in shutdown
and Full Recovery writer draining. No film footage or unlicensed reference assets
are distributed.

## Validation and release

Run `npm run check`, `node --test test/learning-chess*.test.js`, both chess browser
smoke scripts and direct-assignment browser regressions. Browser scripts use
separately installed Playwright/local Edge, not a new application dependency.
On Windows run `py -3.11 C:/ChatGPT/Workspace/Tools/RoomGoblin-LinuxTests.py` from
the actual worktree for the full native Linux suite.

Synthetic tests do not establish live Schoology launch, gradebook, physical device
or classroom GPU acceptance. Re-export ZIPs after deployment for new assets; new
ZIPs require the matching backend. Keep incomplete enhancements in a draft PR.
Deploy through the reviewed main updater with image checks, mandatory backup and
rollback. Additive schema changes preserve unrelated learning, media and room data.
