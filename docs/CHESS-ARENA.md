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

SCORM exports name the bundled renderer `cinematic/view.js` and rewrite only the
packaged board's import to that path. Some LMS file servers do not recognize
`.mjs` as JavaScript; browsers reject module imports served with a non-JavaScript
MIME type. The authenticated Control Center retains its existing `.mjs` route.
The export regression opens Fantasy 3D inside an LMS iframe whose server only
recognizes `.js`, then returns to 2D without score changes. This synthetic check
does not certify the actual Schoology host's MIME, CSP or GPU configuration.

### Camera, animations and premoves

The optional 3D view offers angled, overhead and player presets plus rotation,
tilt, zoom and reset controls in both teacher and SCORM interfaces. Settings stay
in the current page and survive polling and switching between 2D and 3D. Computer
responses commit two plies under one revision; the renderer presents that exact
confirmed pair in sequence rather than suppressing it. Castling also animates
the rook. Reconnect, hidden pages, reduced motion and newer state cancel obsolete
presentation; neither animation nor camera motion owns chess rules or clocks.

Owned active multiplayer games support one local premove while the opponent is
thinking. Select or drag your own piece and choose a destination; the queued
squares and Cancel premove control identify the intent. Escape also cancels it.
The next confirmed turn must preserve the game, own seat, scope and move-history
prefix, and contain that move in the server-provided legal move list. The existing
move endpoint still checks legality, turn and revision. A queued move is sent once
only; rejected moves are not retried. No fixed artificial time deduction is added:
the existing server clock, including normal network and polling delay, applies.

Premoves are not persisted, multi-step plans or coaching. They cancel on game or
identity changes, pause/read-only/reconnecting state, hidden or unfocused windows,
finished games, inconsistent history or an illegal resulting move. This first
implementation is multiplayer-only; computer games remain an atomic request and
response and do not expose a separately playable opponent-thinking turn.

The next-phase feature proposals are in [the learning roadmap](CHESS-COM-FEATURE-ROADMAP.md)
and [the gameplay research inventory](CHESS-COM-PLAY-FEATURES-RESEARCH.md). They are
research, not a claim of implemented functionality.

All classes share matchmaking. Each seat retains its original assignment and
private bearer scope. Both must retain access before matching or moving. Up to
12 waiting/active games per account are saved, with an instance limit of 250.
Untimed games do not expire through inactivity. Unique persisted creation request
IDs make retries idempotent while allowing multiple games. Legacy clients retain
resume behavior. Automatic matching uses recently connected waiting players.
Unjoined multiplayer requests with zero moves automatically expire after 24 hours
without either a queue update or an owner heartbeat for that assignment. The
freeze-aware background sweep runs at most once per minute and retains the
request as `queue expired`, with no win, loss or draw. Active untimed games never
expire because a player is offline; expired requests can be replaced by creating
a new game.
Students can cancel queues, forfeit multiplayer or stop practice; normal chess
endings also finish games.

Clocks: untimed, 3+0, 5+0, 5+3, 10+0 and 15+10; solo is untimed. The server owns
remaining time, increments and flag results. Browser countdowns are estimates and
never declare wins. Timed games continue while disconnected. Assignment pauses
or closure suspend clocks when reconciled. Clock processing respects writer
freezes and shutdown admission; failures remain visible. Server downtime is
charged from stored wall-clock anchors on restart; reliable system time matters.
Legacy Beginner, Standard and Advanced saved games retain bounded worker-thread
search. New fixed Normal through Grandmaster challenges use the separately
packaged Stockfish engine. These labels are not rated strength claims.
Participation grading remains five validated player
moves at four points each, capped at 20; winning is never required.

## Teaching and practice explanations

New computer games default to **Adaptive Live**. It combines the participant's
recent private outcome evidence with a bounded position signal on each reply:
material balance can move the challenge one band, and check/material conditions
can change style. **Adaptive Practice** snapshots its band/style when created and
keeps those settings throughout that game. **Adaptive Coach** adds the teaching
panel to live adaptation; opening that panel alone is not recorded as assistance.
Actual position hints mark the game assisted. Existing saved game difficulty IDs
and boards are preserved.

The server selects only legal engine-evaluated candidates within a small score
window; incomplete or mate-valued candidate sets retain the engine's choice.
Native work is bounded and failure leaves the saved board unchanged. Individual
profiles stay within the original participant/assignment. Shared opening trends
influence style only after ten eligible games and five distinct accounts; no
other player's profile or history is returned. Completed results are summarized
once, while five historical games at most are summarized per minute by the
freeze-aware chess maintenance timer. Historical computer games with unknown
assistance cannot estimate strength. This is adaptive selection, not online
neural-network retraining. See [adaptive design](CHESS-ADAPTIVE-BOTS-RESEARCH.md).

Six original guided drills validate attempts on the server and save private,
assistance-aware progress. Their start/attempt/hint routes use revisions and
request IDs, scoped private bearers, availability checks and transactional audit.
They never change live matches or grades. Local Square finder practice adds
untimed or 30/60-second coordinate rounds without persistent scoring or network
calls. See [practice lifecycle](CHESS-VISION-PRACTICE.md) and the
[implementation status](CHESS-ROADMAP-STATUS.md).

The teaching companion includes six piece guides, five lesson stages (basics,
safety, tactics, strategy and endgames), fourteen independent practice questions
and explanations for answers. Lessons are bundled locally in teacher/SCO assets;
quiz progress is an in-memory learning aid, not an assignment grade or verified
mastery record. See [the curriculum and fair-play contract](CHESS-TEACHING.md).

**Explain practice position** requests at most three legal examples with factual
reasons from the saved server position. It is available only in the learner's own
active solo/computer practice; computer games require the human turn. The endpoint
checks original assignment scope, current revision, enabled/revoked seats and
assignment availability. All multiplayer hints are denied, including teacher
participants and spectators. Requests are bounded to 12 per learner per minute
across games, with a bounded in-memory limiter. No move, clock, participation
score, attendance or standings changes result from a hint. These explanations
neither rank the best moves nor predict who will win.

Teaching additions require a matching backend and a freshly exported ZIP. The
broader beginner-to-advanced curriculum remains a design plan; no rating, title
or educational improvement is guaranteed. [Realistic character asset research](CHESS-REALISM-ASSETS.md)
identifies possible future models/animations and their limitations. Detailed
third-party character archives have not been imported or verified. The current
original 3D cast remains a prototype with classroom GPU acceptance pending.

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

Run `npm run check`, `node --test test/learning-chess*.test.js`, the browser scripts
`test/browser/learning-chess-smoke.cjs`,
`test/browser/learning-chess-interaction-smoke.cjs` and
`test/browser/learning-chess-coach-smoke.cjs`, plus direct-assignment regressions. Browser scripts use
separately installed Playwright/local Edge, not a new application dependency.
On Windows run `py -3.11 C:/ChatGPT/Workspace/Tools/RoomGoblin-LinuxTests.py` from
the actual worktree for the full native Linux suite.

Synthetic tests do not establish live Schoology launch, gradebook, physical device
or classroom GPU acceptance. Re-export ZIPs after deployment for new assets; new
ZIPs require the matching backend. Keep incomplete enhancements in a draft PR.
Deploy through the reviewed main updater with image checks, mandatory backup and
rollback. Additive schema changes preserve unrelated learning, media and room data.
