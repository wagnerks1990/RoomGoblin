# Chess feature research and RoomGoblin roadmap

Reviewed **20 November 2026**. This is a public-documentation inventory and an
implementation proposal, not a claim that the proposed features already exist.
It covers the major publicly documented Chess.com product areas relevant to this
school chess game. It is not an exhaustive inventory of every experiment, paid
screen or mobile build. No paid account or private implementation was inspected.
Chess.com itself notes that features can roll out gradually in its
[product updates](https://www.chess.com/blog/Product/whats-new-on-chess-com).

Use product capabilities as research, with original RoomGoblin implementation,
copy, lesson content and artwork. This work does not license copying Chess.com
courses, puzzle collections, bot characters, coaching text or proprietary scores.
Do not make the school application depend on Chess.com accounts or network calls.

## Recommended order

1. Finish camera usability, confirmed move animations and safe single premoves.
2. Build a teaching loop: short lesson → original practice position → independent
   attempt → explanation → revisit a similar position later.
3. Add completed-game replay and teacher feedback, then bounded engine review.
4. Give teachers private skill evidence and assignable practice, without changing
   existing participation grades or public competitive standings.
5. Add class events and richer customization after the learning path is reliable.

The best next feature is **guided practice with feedback**, followed by **learn
from your finished game**. A large catalog of cosmetics or an unverified numeric
accuracy score should not precede those experiences. This priority is a RoomGoblin
product recommendation, not a claim made by Chess.com.

## Current RoomGoblin baseline and gaps

The released game has server-validated standard chess, universal cross-class
matching, saved games, clocks, separate practice results, privacy-safe standings,
teacher monitoring, local 2D/optional 3D and SCORM participation reporting. The
teaching companion supplies piece guides, five lesson stages, fourteen independent
questions and bounded legal examples in owned practice games. Quiz answers are
currently local session state, not durable mastery evidence.

The camera/animation/premove branch is work in progress. Do not describe it as
deployed until its separate validation and release are complete. The user confirmed
that the corrected `.js` SCORM renderer package resolved the reported Schoology
3D loading problem; that does not establish acceptance of later gameplay changes.

Missing major teaching systems include a durable learning profile, original puzzle
bank, saved practice-position sessions, completed-game analysis, branching studies,
teacher assignment/reporting for chess skills, and calibrated adaptive practice.

## Coaching and guided learning inventory

Chess.com's [Play Coach](https://support.chess.com/en/articles/10877257-how-do-i-play-against-the-coach)
documents guided bot play, selectable strength/color, feedback, escalating hints,
undo, threat/suggestion arrows and evaluation controls. Its
[bot documentation](https://support.chess.com/en/articles/8614091-how-can-i-play-against-the-chess-com-bots)
describes adaptive opponents, personalities, assistance options and separate
unrated bot achievements. These are documented capabilities, not measured evidence
of teaching effectiveness.

| Feature to consider | RoomGoblin adaptation | Priority / dependency |
|---|---|---|
| Guided coach opponent | Separate practice mode explaining an observed idea after each confirmed move | P1; trustworthy explanation service |
| Hint ladder | First ask a question, then identify a relevant piece or threat, finally reveal a verified line | P1; per-attempt assistance log |
| Undo and retry | Branch a practice attempt; never rewrite a competitive game or its result | P1; practice-history model |
| Threat arrows | Explain which piece is attacked and why; label suggestions as practice assistance | P1; verified tactical facts |
| Suggested moves | Show a few engine-supported candidates only in practice/completed analysis | P2; bounded engine worker |
| Move feedback | Explain the consequence of a move with a concrete board variation | P2; stable analysis evidence |
| Adaptive opponent | Offer an easier next task after repeated difficulty; make adaptation visible and optional | P2; calibrated difficulty, separate stats |
| Additional bot levels | Add tested strength presets, selectable color and original teaching personalities | P2; benchmark and CPU budgets |
| Assistance-aware achievements | Distinguish independent success from success with hints, without shaming students | P2; durable provenance |
| Spoken coach / avatar | Optional local narration, text equivalent, mute and reduced-motion settings | P3; accessible local assets and audio policy |

The first coach should be factual and deterministic. An optional language model
may rephrase verified facts later, but it must not invent legal moves, claim forced
mate without proof, alter results, or send student identities to external services.
Live multiplayer remains unassisted, including teacher participants and spectators.

## Lessons, practice and learning progression

Chess.com's [Lessons](https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com)
offers a sequenced path and searchable library with interactive exercises spanning
beginner to advanced topics. [Study Plans](https://support.chess.com/en/articles/8709046-what-is-a-study-plan-on-chess-com)
organize related learning resources. [Practice](https://support.chess.com/en/articles/8724749-what-is-practice-on-chess-com)
covers openings, thematic drills, master-game positions and custom FEN setups.
[Endgames](https://support.chess.com/en/articles/8708978-how-do-i-practice-endgames)
combines instruction, practice and timed challenges.

| Feature to consider | RoomGoblin adaptation | Priority / dependency |
|---|---|---|
| Beginner diagnostic | Short ungraded placement tasks; let teacher or learner choose an easier starting point | P1; original task bank |
| Lesson path | Rules → safe pieces → simple mates → tactics → planning → endgames | P1; versioned curriculum |
| Lesson library | Search/filter by topic and difficulty; revisit without losing history | P1; content metadata |
| Interactive challenges | Require an actual legal move and explain a wrong attempt | P1; isolated practice positions |
| Rule laboratories | Castling, en passant, promotion, check evasion and draw claims | P1; curated regression-tested positions |
| Study plans | Short teacher-assigned sequences with optional suggested daily practice | P1; assignment ownership |
| Endgame practice | King-and-rook mate, queen mate, opposition, promotion races, basic rook endings | P1; verified solution conditions |
| Opening practice | Teach development and king safety before memorized lines; allow both colors | P2; licensed/original opening data |
| Custom positions | Teacher position editor and bounded FEN import with legality checks | P2; separate from competitive matches |
| Master-game studies | Original annotations on properly sourced games | P2; provenance ledger |
| Board vision | Find squares/read notation with optional timer, both orientations and coordinates | P1; accessible input |
| Skill progress | Record evidence, assistance and recent independent performance per concept | P2; durable private skill model |
| Spaced review | Revisit missed ideas later with a different position | P2; scheduler independent of room automation |

[Vision](https://support.chess.com/en/articles/8615408-what-is-vision) documents
coordinate and move-recognition exercises. Chess.com's
[Skills](https://support.chess.com/en/articles/16243840-what-are-skills-on-chess-com)
rewards demonstrated habits in Coach/Game Review. RoomGoblin should keep its own
skill definitions and evidence thresholds; finishing a quiz or collecting points
must not be presented as a verified chess rating or formal title progress.

## Puzzles and motivating practice

[Chess.com's puzzle guide](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
describes rated puzzles, theme/rating filters, revisiting failed puzzles, daily
puzzles, timed and survival runs, and head-to-head puzzle competition. It also
distinguishes puzzle rating from playing strength. RoomGoblin should start with
untimed understanding and introduce speed as an optional challenge.

| Feature to consider | RoomGoblin adaptation | Priority / dependency |
|---|---|---|
| Themed tactics | Fork, pin, skewer, discovered attack, hanging piece and mate themes | P1; original/licensed positions |
| Daily class puzzle | Teacher-selected challenge with explanation after independent attempt | P1; timezone and assignment scope |
| Missed-puzzle review | Personal retry queue with spaced alternatives | P1; private attempt history |
| Difficulty adaptation | Adjust the next task from independent evidence, not only speed | P2; enough calibrated items |
| Timed puzzle run | Optional classroom challenge; separate from ordinary assessment | P2; server-owned challenge scoring |
| Untimed survival | Increasing difficulty without speed pressure | P2; reproducible challenge sets |
| Puzzle duel | Teacher-enabled shared challenge with equal tasks and audited results | P3; fairness and capacity tests |
| Puzzle dashboard | Attempts, themes, hints and independent improvement | P2; private by default |

Do not scrape Chess.com's puzzle library. Store puzzle source/license, initial
position, allowed continuations, terminal success condition, alternatives and
explanations. Test more than one valid answer where applicable. A short stored
principal variation is not proof that every other move is wrong.

## Completed-game review and analysis

[Game Review](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
documents evaluation graphs, key moments, explanations, retry opportunities and
review controls. [Game Collections](https://support.chess.com/en/articles/13557248-how-do-i-use-game-collections)
supports organized studies with sharing roles and imports. The
[Game Explorer](https://support.chess.com/en/articles/8615183-what-is-the-game-explorer)
supports studying opening continuations. These inspire separate post-game tools,
not assistance during a competitive game.

| Feature to consider | RoomGoblin adaptation | Priority / dependency |
|---|---|---|
| Move-by-move replay | Navigate completed games with keyboard, move list and 2D/3D view | P1; read-only history projection |
| Student self-review | Ask what changed before revealing analysis | P1; private annotations |
| Key turning points | Select a few instructive mistakes or successful ideas | P2; stable engine results |
| Retry a mistake | Start an isolated exercise from a completed-game position | P2; practice branch, no result mutation |
| Evaluation graph | Explain advantage and uncertainty; show analysis depth/settings | P2; bounded reproducible engine |
| Variations and arrows | Annotate alternatives without altering original moves | P2; study permissions |
| PGN/FEN import/export | Export own games with privacy-safe headers; validate bounded imports | P2; parser/security review |
| Collections / favorites | Organize personal or teacher-shared studies | P2; viewer/editor ACLs |
| Opening explorer | Start with the learner's own games and small attributed opening data | P3; privacy and data rights |
| Tablebase endgames | Optional exact small-material analysis with explicit rule semantics | P3; storage/license feasibility |
| Personal recommendations | Suggest a lesson from repeated verified mistakes | P2; explainable recommendation rules |

Chess.com's [engine overview](https://support.chess.com/en/articles/9462780-how-do-the-chess-engines-on-chess-com-work)
distinguishes server and browser analysis and notes browser/download constraints.
RoomGoblin should prefer bounded server jobs first: cancelable workers, concurrency
limits, shutdown/freeze drain, versioned engine/configuration and private caches.
Do not assume threaded browser engines work inside Schoology or weaken its security
headers to make them work. Do not copy proprietary accuracy or brilliant-move formulas.

## Teacher tools, reporting and classroom learning

[Chess.com Classroom](https://support.chess.com/en/articles/8708915-how-do-i-use-classroom-on-chess-com)
documents shared analysis boards, loading positions/games, participant move-control
permissions, coach-only analysis visibility and communication controls.
[Insights](https://support.chess.com/en/articles/8708925-what-is-insights-on-chess-com)
documents result breakdowns, phase/opening performance and tactical patterns.
RoomGoblin should adapt these to school permission boundaries rather than public
profile defaults.

| Feature to consider | RoomGoblin adaptation | Priority / dependency |
|---|---|---|
| Teacher demonstration board | Separate instructional session; students follow or explore a private branch | P2; session authority |
| Give a learner the move | Explicit temporary turn control on the lesson board only | P2; audited scoped grants |
| Assign a position/lesson | Class task with rubric, independent attempt and coaching phase | P1; existing direct-assignment contracts |
| Private teacher feedback | Comment on completed games and recommend one next step | P1; class membership |
| Class skill summary | Aggregate common missed ideas with private student drill-down | P2; small-group privacy thresholds |
| Assistance-aware reporting | Show hints/retries separately from independent performance | P1; attempt provenance |
| Outcome analytics | Preserve checkmate, resignation, timeout, draw and practice distinctions | Existing foundation; extend carefully |
| Learning progress on TV | Opt-in achievements/aggregate milestones; no private weakness or grade display | P3; public projection review |
| Study sharing | Teacher-approved class collections with viewer/editor roles | P2; no cross-class roster leakage |
| Full history search | Paginated own/authorized games with result/date/mode filters | P1; indexed queries and retention policy |

Keep learning grades independent of win rate, speed, assistance and public rank.
Any new graded task needs an explicit rubric and teacher-owned publication.
Existing SCORM identity remains reported attribution plus a scoped private bearer;
names must never become authentication or automatic account merging.

## Buildable next-phase packages

**A — Teaching foundations (medium scope):** versioned original position bank,
practice session API, hint ladder, retry branches, private attempt records and
teacher assignment controls. Acceptance: legal alternatives work; hints do not
count as independent answers; reconnect resumes the same attempt; cross-class and
revoked-bearer access fails; existing SCORM participation remains unchanged.

**B — Learn from a game (large scope):** completed-game replay, self-reflection,
bounded analysis worker and three useful takeaways. Acceptance: active competitive
games cannot be analyzed through learner or spectator APIs; stored evidence names
engine/version/depth; failures are visible; no automatic accusations or invented
mate claims; original moves/results are immutable.

**C — Teacher learning dashboard (medium/large scope):** assignable lesson sets,
private progress by concept, feedback and class summaries. Acceptance: authorized
teacher drill-down only; public displays contain no private assessment; exporting
or updating preserves progress; reports distinguish practice, assessed work and
competitive play.

**D — Engagement and events (later):** original bot personalities, optional class
tournaments, puzzle challenges and cosmetics. Acceptance: gameplay stays usable
without animations/audio, time/result rules are explicit, and rewards do not
encourage abandoning games or humiliating beginners.

Effort labels are relative engineering estimates, not promised dates. A depends
on a reviewed practice/attempt schema; B adds an engine lifecycle and licensing
decision; C depends on A's evidence; D should follow classroom acceptance.

## Research limits and follow-up

Read the [companion gameplay inventory](CHESS-COM-PLAY-FEATURES-RESEARCH.md) for additional play, customization, event,
social and export features. Treat feature names and platform availability as a
dated snapshot. Review actual accessibility with keyboard/screen reader and actual
Schoology delivery rather than inferring it from marketing. No Chess.com lesson,
puzzle, avatar or internal scoring implementation has been imported.
